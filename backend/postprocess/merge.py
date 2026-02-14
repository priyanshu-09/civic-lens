from __future__ import annotations

from pathlib import Path
from typing import Any

from backend.models.types import FinalEvent
from backend.utils.io import read_json, write_json


def _event_type_from(resp: dict[str, Any]) -> str:
    return str(resp.get("event_type", "RECKLESS_DRIVING"))


def _anchor_paths(packet: dict[str, Any]) -> list[str]:
    anchors = packet.get("anchor_frames", [])
    out: list[str] = []
    for a in anchors[:3]:
        p = a.get("path")
        if isinstance(p, str) and p:
            out.append(p)
    return out


def merge_results(run_dir: Path) -> list[FinalEvent]:
    packets_payload = read_json(run_dir / "packets.json") if (run_dir / "packets.json").exists() else {"packets": []}
    packets = packets_payload.get("packets", [])
    flash_decisions = read_json(run_dir / "flash_decisions.json").get("decisions", []) if (run_dir / "flash_decisions.json").exists() else []
    pro_decisions = read_json(run_dir / "pro_decisions.json").get("decisions", []) if (run_dir / "pro_decisions.json").exists() else []

    flash_by_packet = {d.get("packet_id"): d for d in flash_decisions if d.get("packet_id")}
    pro_by_packet = {d.get("packet_id"): d for d in pro_decisions if d.get("packet_id")}

    packets_sorted = sorted(packets, key=lambda p: int(p.get("candidate_rank", 10_000)))

    final_events: list[FinalEvent] = []
    trace_entries: list[dict[str, Any]] = []
    flash_only_counter = 1

    for packet in packets_sorted:
        packet_id = packet.get("packet_id")
        local = packet.get("local", {})
        local_score = float(local.get("local_score", 0.5))
        anchors = _anchor_paths(packet)

        flash = flash_by_packet.get(packet_id)
        pro = pro_by_packet.get(packet_id)

        trace = {
            "packet_id": packet_id,
            "candidate_id": packet.get("candidate_id"),
            "local": local,
            "flash": None,
            "pro": None,
            "final_event_id": None,
            "dropped_reason": None,
        }

        if flash:
            trace["flash"] = {
                "status": flash.get("status"),
                "latency_ms": flash.get("latency_ms"),
                "response": flash.get("response"),
            }
        if pro:
            trace["pro"] = {
                "status": pro.get("status"),
                "latency_ms": pro.get("latency_ms"),
                "response": pro.get("response"),
            }

        if pro and isinstance(pro.get("response"), dict):
            resp = pro["response"]
            confidence = float(resp.get("confidence", local_score))
            blended_conf = round(0.45 * local_score + 0.55 * confidence, 3)
            risk_val = float(resp.get("risk_score", local_score * 100.0))
            blended_risk = round(0.4 * (local_score * 100.0) + 0.6 * risk_val, 2)

            event = FinalEvent(
                event_id=str(resp.get("event_id", f"evt_{packet_id}")),
                packet_id=packet_id,
                source_stage="PRO_FINAL",
                event_type=_event_type_from(resp),
                start_time=float(resp.get("start_time", packet.get("window_start_s", 0.0))),
                end_time=float(resp.get("end_time", packet.get("window_end_s", 0.0))),
                confidence=blended_conf,
                risk_score=blended_risk,
                violator_description=str(resp.get("violator_description", "")),
                plate_text=resp.get("plate_text"),
                plate_candidates=resp.get("plate_candidates", []),
                evidence_frames=anchors,
                report_images=[],
                evidence_clip_path=resp.get("evidence_clip_path"),
                key_moments=resp.get("key_moments", []),
                explanation_short=str(resp.get("explanation_short", "")),
                uncertain=bool(resp.get("uncertain", False)),
                uncertainty_reason=resp.get("uncertainty_reason"),
            )
            final_events.append(event)
            trace["final_event_id"] = event.event_id
            trace_entries.append(trace)
            continue

        flash_resp = flash.get("response") if flash else None
        if isinstance(flash_resp, dict) and bool(flash_resp.get("is_relevant", False)):
            event = FinalEvent(
                event_id=f"evt_{flash_only_counter:03d}_{packet_id}",
                packet_id=packet_id,
                source_stage="FLASH_ONLY",
                event_type=_event_type_from(flash_resp),
                start_time=float(flash_resp.get("start_time", packet.get("window_start_s", 0.0))),
                end_time=float(flash_resp.get("end_time", packet.get("window_end_s", 0.0))),
                confidence=round(0.45 * local_score + 0.55 * float(flash_resp.get("confidence", local_score)), 3),
                risk_score=round((local_score * 100.0) * 0.7, 2),
                violator_description=str(flash_resp.get("violator_description", "")),
                plate_text=None,
                plate_candidates=[],
                evidence_frames=anchors,
                report_images=[],
                evidence_clip_path=None,
                key_moments=[{"t": float(flash_resp.get("start_time", packet.get("window_start_s", 0.0))), "note": "Flash-only event"}],
                explanation_short="Potential event identified by local packet and Flash validation.",
                uncertain=True,
                uncertainty_reason="Not escalated to Pro",
            )
            final_events.append(event)
            flash_only_counter += 1
            trace["final_event_id"] = event.event_id
            trace_entries.append(trace)
            continue

        reasons = packet.get("routing", {}).get("routing_reason", [])
        if reasons:
            trace["dropped_reason"] = reasons[-1]
        elif flash and isinstance(flash_resp, dict) and not bool(flash_resp.get("is_relevant", False)):
            trace["dropped_reason"] = "flash_not_relevant"
        else:
            trace["dropped_reason"] = "not_processed"
        trace_entries.append(trace)

    summary = {
        "packets_total": len(packets_sorted),
        "final_events": len(final_events),
        "dropped_packets": len([t for t in trace_entries if t.get("final_event_id") is None]),
        "pro_final_events": len([e for e in final_events if e.source_stage == "PRO_FINAL"]),
        "flash_only_events": len([e for e in final_events if e.source_stage == "FLASH_ONLY"]),
    }

    write_json(run_dir / "events_final.json", {"events": [e.model_dump() for e in final_events]})
    write_json(run_dir / "trace.json", {"summary": summary, "packets": trace_entries})
    return final_events
