from __future__ import annotations

from pathlib import Path

from backend.models.types import Candidate, FinalEvent, FlashEvent
from backend.utils.io import read_json, write_json


def _normalize_frame_path(run_dir: Path, frame_path: str) -> str:
    p = Path(frame_path)
    if p.is_absolute():
        try:
            return str(p.resolve().relative_to(run_dir.resolve()))
        except ValueError:
            return str(p)
    return str(p)


def _select_evidence_frames(run_dir: Path, manifest: dict, start: float, end: float) -> list[str]:
    frames = manifest.get("frames", [])
    in_window = [f for f in frames if start <= f["ts_sec"] <= end]
    if not in_window:
        return []
    if len(in_window) <= 3:
        return [_normalize_frame_path(run_dir, f["path"]) for f in in_window]
    mid = len(in_window) // 2
    picked = [in_window[0]["path"], in_window[mid]["path"], in_window[-1]["path"]]
    return [_normalize_frame_path(run_dir, p) for p in picked]


def merge_results(run_dir: Path) -> list[FinalEvent]:
    candidates = {c["candidate_id"]: Candidate(**c) for c in read_json(run_dir / "candidates.json").get("candidates", [])}
    flash_events = [FlashEvent(**e) for e in read_json(run_dir / "flash_events.json").get("events", [])]
    pro_events = [FinalEvent(**e) for e in read_json(run_dir / "pro_events.json").get("events", [])]
    manifest = read_json(run_dir / "frames_manifest.json")

    pro_by_type_time = {(e.event_type, round(e.start_time, 1), round(e.end_time, 1)): e for e in pro_events}

    merged: list[FinalEvent] = []
    counter = 1

    for flash in flash_events:
        if not flash.is_relevant:
            continue

        key = (flash.event_type, round(flash.start_time, 1), round(flash.end_time, 1))
        candidate = candidates.get(flash.candidate_id)
        local_score = candidate.score if candidate else 0.5

        if key in pro_by_type_time:
            event = pro_by_type_time[key]
            event.confidence = round(0.45 * local_score + 0.55 * event.confidence, 3)
            event.risk_score = round(0.4 * (local_score * 100) + 0.6 * event.risk_score, 2)
            event.evidence_frames = _select_evidence_frames(run_dir, manifest, event.start_time, event.end_time)
            event.report_images = []
            merged.append(event)
            continue

        merged.append(
            FinalEvent(
                event_id=f"evt_{counter:03d}",
                event_type=flash.event_type,
                start_time=flash.start_time,
                end_time=flash.end_time,
                confidence=round(0.45 * local_score + 0.55 * flash.confidence, 3),
                risk_score=round((local_score * 100) * 0.7, 2),
                violator_description=flash.violator_description,
                plate_text=None,
                plate_candidates=[],
                evidence_frames=_select_evidence_frames(run_dir, manifest, flash.start_time, flash.end_time),
                report_images=[],
                evidence_clip_path=None,
                key_moments=[{"t": flash.start_time, "note": "Flash-only event"}],
                explanation_short="Potential event identified by local pipeline and Flash validation.",
                uncertain=True,
                uncertainty_reason="Not escalated to Pro",
            )
        )
        counter += 1

    merged.sort(key=lambda e: e.start_time)

    deduped: list[FinalEvent] = []
    for event in merged:
        duplicate = False
        for prior in deduped:
            if prior.event_type != event.event_type:
                continue
            overlap = max(0.0, min(prior.end_time, event.end_time) - max(prior.start_time, event.start_time))
            shorter = min(prior.end_time - prior.start_time, event.end_time - event.start_time)
            if shorter > 0 and overlap / shorter > 0.4:
                duplicate = True
                if event.confidence > prior.confidence:
                    deduped.remove(prior)
                    deduped.append(event)
                break
        if not duplicate:
            deduped.append(event)

    write_json(run_dir / "events_final.json", {"events": [e.model_dump() for e in deduped]})
    return deduped
