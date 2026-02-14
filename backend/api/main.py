from __future__ import annotations

import shutil
import threading
import uuid
from pathlib import Path
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
    if run_id not in [r.run_id for r in store.all()]:
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
    run_dir = settings.runs_dir / run_id
    path = run_dir / "events_final.json"
    if not path.exists():
        return {"events": []}
    return read_json(path)


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
    run_dir = settings.runs_dir / run_id
    log_path = run_dir / "pipeline.log.jsonl"
    return {"lines": tail_logs(log_path, lines=max(1, min(500, tail)))}


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
