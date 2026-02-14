from __future__ import annotations

import shutil
import threading
import uuid
from pathlib import Path
from typing import Any
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.config.settings import load_settings
from backend.logging_utils.json_logger import tail_logs
from backend.models.types import ReviewDecision, RunRecord, RunState, RunStatus, Stage
from backend.pipeline.orchestrator import export_run, run_pipeline
from backend.pipeline.store import RunStore
from backend.utils.io import read_json, write_json


settings = load_settings()
store = RunStore(settings.runs_dir)
threads: dict[str, threading.Thread] = {}

app = FastAPI(title="Civic Lens API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _read_or_default(path: Path, default: dict[str, Any]) -> dict[str, Any]:
    if path.exists():
        return read_json(path)
    return default


def _anchor_paths(packet: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for item in packet.get("anchor_frames", [])[:3]:
        p = item.get("path")
        if isinstance(p, str) and p:
            out.append(p)
    return out


def _build_live_trace(run_dir: Path) -> dict[str, Any]:
    packets = _read_or_default(run_dir / "packets.json", {"packets": []}).get("packets", [])
    flash_decisions = _read_or_default(run_dir / "flash_decisions.json", {"decisions": []}).get("decisions", [])
    pro_decisions = _read_or_default(run_dir / "pro_decisions.json", {"decisions": []}).get("decisions", [])

    flash_by_packet = {d.get("packet_id"): d for d in flash_decisions if d.get("packet_id")}
    pro_by_packet = {d.get("packet_id"): d for d in pro_decisions if d.get("packet_id")}

    packets_sorted = sorted(packets, key=lambda p: int(p.get("candidate_rank", 10_000)))
    trace_entries: list[dict[str, Any]] = []
    for packet in packets_sorted:
        packet_id = packet.get("packet_id")
        routing = packet.get("routing", {})
        flash = flash_by_packet.get(packet_id)
        pro = pro_by_packet.get(packet_id)

        final_event_id = None
        dropped_reason = None
        if isinstance(pro, dict) and isinstance(pro.get("response"), dict):
            final_event_id = pro["response"].get("event_id")
        elif isinstance(flash, dict) and isinstance(flash.get("response"), dict) and bool(flash["response"].get("is_relevant", False)):
            final_event_id = f"live_flash_{packet_id}"
        else:
            reasons = routing.get("routing_reason", [])
            if reasons:
                dropped_reason = reasons[-1]
            elif isinstance(flash, dict) and isinstance(flash.get("response"), dict) and not bool(flash["response"].get("is_relevant", False)):
                dropped_reason = "flash_not_relevant"

        trace_entries.append(
            {
                "packet_id": packet_id,
                "candidate_id": packet.get("candidate_id"),
                "anchor_frames": packet.get("anchor_frames", []),
                "local": packet.get("local", {}),
                "routing": routing,
                "flash": (
                    {
                        "status": flash.get("status"),
                        "latency_ms": flash.get("latency_ms"),
                        "response": flash.get("response"),
                    }
                    if flash
                    else None
                ),
                "pro": (
                    {
                        "status": pro.get("status"),
                        "latency_ms": pro.get("latency_ms"),
                        "response": pro.get("response"),
                    }
                    if pro
                    else None
                ),
                "final_event_id": final_event_id,
                "dropped_reason": dropped_reason,
            }
        )

    summary = {
        "packets_total": len(trace_entries),
        "flash_done": len([t for t in trace_entries if t.get("flash") is not None]),
        "pro_done": len([t for t in trace_entries if t.get("pro") is not None]),
        "finalized": len([t for t in trace_entries if t.get("final_event_id")]),
        "dropped_packets": len([t for t in trace_entries if t.get("final_event_id") is None and t.get("dropped_reason") is not None]),
    }
    return {"summary": summary, "packets": trace_entries, "provisional": True}


def _build_live_events(run_dir: Path) -> list[dict[str, Any]]:
    packets = _read_or_default(run_dir / "packets.json", {"packets": []}).get("packets", [])
    flash_decisions = _read_or_default(run_dir / "flash_decisions.json", {"decisions": []}).get("decisions", [])
    pro_decisions = _read_or_default(run_dir / "pro_decisions.json", {"decisions": []}).get("decisions", [])

    flash_by_packet = {d.get("packet_id"): d for d in flash_decisions if d.get("packet_id")}
    pro_by_packet = {d.get("packet_id"): d for d in pro_decisions if d.get("packet_id")}

    events: list[dict[str, Any]] = []
    packets_sorted = sorted(packets, key=lambda p: int(p.get("candidate_rank", 10_000)))
    for packet in packets_sorted:
        packet_id = packet.get("packet_id")
        local = packet.get("local", {})
        local_score = float(local.get("local_score", 0.0))
        event_type = local.get("proposed_event_type", "RECKLESS_DRIVING")
        anchors = _anchor_paths(packet)
        start_time = float(packet.get("window_start_s", 0.0))
        end_time = float(packet.get("window_end_s", 0.0))

        flash_resp = flash_by_packet.get(packet_id, {}).get("response")
        pro_resp = pro_by_packet.get(packet_id, {}).get("response")
        routing = packet.get("routing", {})

        if isinstance(pro_resp, dict):
            events.append(
                {
                    "event_id": str(pro_resp.get("event_id", f"live_pro_{packet_id}")),
                    "packet_id": packet_id,
                    "source_stage": "PRO_LIVE",
                    "event_type": pro_resp.get("event_type", event_type),
                    "start_time": float(pro_resp.get("start_time", start_time)),
                    "end_time": float(pro_resp.get("end_time", end_time)),
                    "confidence": float(pro_resp.get("confidence", local_score)),
                    "risk_score": float(pro_resp.get("risk_score", pro_resp.get("risk_score_gemini", local_score * 100.0))),
                    "violator_description": str(pro_resp.get("violator_description", "")),
                    "plate_text": pro_resp.get("plate_text"),
                    "plate_candidates": pro_resp.get("plate_candidates", []),
                    "plate_confidence": pro_resp.get("plate_confidence"),
                    "evidence_frames": anchors,
                    "report_images": anchors,
                    "evidence_clip_path": None,
                    "key_moments": pro_resp.get("key_moments", []),
                    "explanation_short": str(pro_resp.get("explanation_short", "Live Pro output pending merge.")),
                    "uncertain": bool(pro_resp.get("uncertain", False)),
                    "uncertainty_reason": pro_resp.get("uncertainty_reason"),
                    "provisional": True,
                }
            )
            continue

        if isinstance(flash_resp, dict) and bool(flash_resp.get("is_relevant", False)):
            events.append(
                {
                    "event_id": f"live_flash_{packet_id}",
                    "packet_id": packet_id,
                    "source_stage": "FLASH_LIVE",
                    "event_type": flash_resp.get("event_type", event_type),
                    "start_time": float(flash_resp.get("start_time", start_time)),
                    "end_time": float(flash_resp.get("end_time", end_time)),
                    "confidence": float(flash_resp.get("confidence", local_score)),
                    "risk_score": round(local_score * 100.0, 2),
                    "violator_description": str(flash_resp.get("violator_description", "Live Flash output pending merge.")),
                    "plate_text": flash_resp.get("plate_text"),
                    "plate_candidates": flash_resp.get("plate_candidates", []),
                    "plate_confidence": flash_resp.get("plate_confidence"),
                    "evidence_frames": anchors,
                    "report_images": anchors,
                    "evidence_clip_path": None,
                    "key_moments": [{"t": float(flash_resp.get("start_time", start_time)), "note": "Flash-detected moment"}],
                    "explanation_short": "Flash marked this packet relevant. Waiting for final merge.",
                    "uncertain": bool(flash_resp.get("uncertain", True)),
                    "uncertainty_reason": flash_resp.get("uncertainty_reason"),
                    "provisional": True,
                }
            )
            continue

        if bool(routing.get("sent_to_flash", False)) and flash_resp is None:
            events.append(
                {
                    "event_id": f"live_local_{packet_id}",
                    "packet_id": packet_id,
                    "source_stage": "LOCAL_PENDING",
                    "event_type": event_type,
                    "start_time": start_time,
                    "end_time": end_time,
                    "confidence": local_score,
                    "risk_score": round(local_score * 100.0, 2),
                    "violator_description": "Local proposal waiting for Flash validation.",
                    "plate_text": None,
                    "plate_candidates": [],
                    "plate_confidence": None,
                    "evidence_frames": anchors,
                    "report_images": anchors,
                    "evidence_clip_path": None,
                    "key_moments": [{"t": start_time, "note": "Local packet queued for Flash"}],
                    "explanation_short": "Detected by local engine. Flash step pending.",
                    "uncertain": True,
                    "uncertainty_reason": "Awaiting Flash validation",
                    "provisional": True,
                }
            )

    events.sort(key=lambda e: float(e.get("start_time", 0.0)))
    return events


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/runs")
async def create_run(
    video: UploadFile = File(...),
    roi_config_json: Optional[str] = Form(default=None),
) -> dict[str, str]:
    run_id = f"run_{uuid.uuid4().hex[:10]}"
    run_dir = settings.runs_dir / run_id
    input_dir = run_dir / "input"
    cfg_dir = run_dir / "config"
    input_dir.mkdir(parents=True, exist_ok=True)
    cfg_dir.mkdir(parents=True, exist_ok=True)

    video_path = input_dir / (video.filename or "upload.mp4")
    with video_path.open("wb") as f:
        shutil.copyfileobj(video.file, f)

    if roi_config_json:
        roi_payload = __import__("json").loads(roi_config_json)
    else:
        roi_payload = read_json(Path("backend/config/default_roi_config.json"))

    roi_path = cfg_dir / "roi_config.json"
    write_json(roi_path, roi_payload)

    status = RunStatus(run_id=run_id, state=RunState.PENDING, stage=Stage.INGEST, progress_pct=0)
    record = RunRecord(run_id=run_id, video_path=str(video_path), roi_config_path=str(roi_path), status=status)
    store.register(record)
    return {"run_id": run_id}


@app.post("/api/runs/{run_id}/start")
def start_run(run_id: str) -> dict[str, str]:
    if not store.exists(run_id):
        raise HTTPException(status_code=404, detail="run_id not found")

    if run_id in threads and threads[run_id].is_alive():
        return {"status": "ALREADY_RUNNING"}

    thread = threading.Thread(target=run_pipeline, args=(run_id, store, settings), daemon=True)
    thread.start()
    threads[run_id] = thread
    return {"status": "STARTED"}


@app.get("/api/runs")
def list_runs() -> dict:
    return {
        "runs": [
            {
                "run_id": r.run_id,
                "state": r.status.state,
                "stage": r.status.stage,
                "progress_pct": r.status.progress_pct,
            }
            for r in store.all()
        ]
    }


@app.get("/api/runs/{run_id}/status")
def run_status(run_id: str) -> dict:
    try:
        record = store.get(run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="run_id not found") from exc
    return record.status.model_dump()


@app.get("/api/runs/{run_id}/events")
def run_events(run_id: str) -> dict:
    if not store.exists(run_id):
        raise HTTPException(status_code=404, detail="run_id not found")
    run_dir = settings.runs_dir / run_id
    path = run_dir / "events_final.json"
    if not path.exists():
        return {"events": _build_live_events(run_dir), "provisional": True}
    payload = read_json(path)
    payload["provisional"] = False
    return payload


@app.post("/api/runs/{run_id}/events/{event_id}/review")
def save_review(run_id: str, event_id: str, decision: ReviewDecision) -> dict[str, str]:
    run_dir = settings.runs_dir / run_id
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail="run_id not found")

    review_path = run_dir / "review.json"
    payload = {"decisions": []}
    if review_path.exists():
        payload = read_json(review_path)

    decisions = [d for d in payload.get("decisions", []) if d.get("event_id") != event_id]
    decisions.append({"event_id": event_id, **decision.model_dump()})
    write_json(review_path, {"decisions": decisions})
    return {"status": "OK"}


@app.get("/api/runs/{run_id}/logs")
def get_logs(run_id: str, tail: int = 50) -> dict:
    if not store.exists(run_id):
        raise HTTPException(status_code=404, detail="run_id not found")
    run_dir = settings.runs_dir / run_id
    log_path = run_dir / "pipeline.log.jsonl"
    return {"lines": tail_logs(log_path, lines=max(1, min(500, tail)))}


@app.get("/api/runs/{run_id}/artifact")
def get_artifact(run_id: str, path: str):
    if not store.exists(run_id):
        raise HTTPException(status_code=404, detail="run_id not found")
    run_dir = (settings.runs_dir / run_id).resolve()

    requested = Path(path)
    if requested.is_absolute():
        resolved = requested.resolve()
    else:
        resolved = (run_dir / requested).resolve()
    if not str(resolved).startswith(str(run_dir)):
        raise HTTPException(status_code=400, detail="invalid artifact path")
    if not resolved.exists() or not resolved.is_file():
        raise HTTPException(status_code=404, detail="artifact not found")
    return FileResponse(resolved)


@app.get("/api/runs/{run_id}/trace")
def get_trace(run_id: str) -> dict:
    if not store.exists(run_id):
        raise HTTPException(status_code=404, detail="run_id not found")
    run_dir = settings.runs_dir / run_id
    trace_path = run_dir / "trace.json"
    if not trace_path.exists():
        payload = _build_live_trace(run_dir)
        payload["message"] = "Live trace generated from packets and Gemini decisions."
        return payload
    payload = read_json(trace_path)
    payload["provisional"] = False
    return payload


@app.get("/api/runs/{run_id}/export")
def export(run_id: str):
    run_dir = settings.runs_dir / run_id
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail="run_id not found")

    try:
        path = export_run(run_id, store, settings)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return FileResponse(path, filename="case_pack.zip", media_type="application/zip")
