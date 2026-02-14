from __future__ import annotations

import time
from pathlib import Path
from typing import Any
from typing import Optional

from backend.config.perf import load_perf_config
from backend.config.settings import Settings
from backend.export.exporter import export_case_pack
from backend.gemini.client import GeminiClient
from backend.logging_utils.json_logger import RunLogger
from backend.models.types import RunState, RunStatus, Stage
from backend.pipeline.store import RunStore
from backend.utils.io import read_json


def _set_status(
    store: RunStore,
    run_id: str,
    *,
    state: RunState,
    stage: Stage,
    progress: int,
    timings: dict[str, int],
    stage_message: Optional[str] = None,
    metrics: Optional[dict[str, Any]] = None,
    error: Optional[str] = None,
    failed_stage: Optional[Stage] = None,
) -> None:
    record = store.get(run_id)
    store.update_status(
        run_id,
        RunStatus(
            run_id=run_id,
            state=state,
            stage=stage,
            progress_pct=progress,
            stage_message=stage_message,
            failed_stage=failed_stage,
            error_message=error,
            timings_ms=timings,
            metrics=metrics or record.status.metrics,
        ),
    )


def run_pipeline(run_id: str, store: RunStore, settings: Settings) -> None:
    # Lazy imports keep API bootable even when CV deps are missing until pipeline start.
    from backend.local_engine.proposal_engine import run_local_proposals
    from backend.pipeline.ingest import ingest_video
    from backend.postprocess.merge import merge_results

    record = store.get(run_id)
    run_dir = settings.runs_dir / run_id
    logger = RunLogger(run_id=run_id, log_file=run_dir / "pipeline.log.jsonl")
    perf_config = load_perf_config(Path("backend/config/perf_config.json"))
    timings: dict[str, int] = {}
    metrics: dict[str, Any] = {
        "packets_total": 0,
        "packets_sent_flash": 0,
        "packets_sent_pro": 0,
        "packets_finalized": 0,
        "packets_dropped": 0,
        "flash_done": 0,
        "pro_done": 0,
        "pro_queued": 0,
        "flash_errors": 0,
        "pro_errors": 0,
        "flash_concurrency": int(perf_config["gemini_flash_concurrency"]),
        "pro_concurrency": int(perf_config["gemini_pro_concurrency"]),
    }

    try:
        _set_status(
            store,
            run_id,
            state=RunState.RUNNING,
            stage=Stage.INGEST,
            progress=5,
            timings=timings,
            stage_message="Preparing ingest",
            metrics=metrics,
        )

        t0 = time.perf_counter()
        manifest = ingest_video(
            video_path=Path(record.video_path),
            run_dir=run_dir,
            short_fps=int(perf_config["analysis_fps_short"]),
            long_fps=int(perf_config["analysis_fps_long"]),
            long_video_threshold_sec=int(perf_config["long_video_threshold_sec"]),
            logger=logger,
        )
        timings[Stage.INGEST.value] = int((time.perf_counter() - t0) * 1000)

        _set_status(
            store,
            run_id,
            state=RunState.RUNNING,
            stage=Stage.LOCAL_PROPOSALS,
            progress=30,
            timings=timings,
            stage_message="Running local proposal heuristics",
            metrics=metrics,
        )
        t1 = time.perf_counter()
        run_local_proposals(
            run_id=run_id,
            run_dir=run_dir,
            roi_config_path=Path(record.roi_config_path),
            proposal_config_path=Path("backend/config/proposal_config.json"),
            perf_config=perf_config,
            logger=logger,
        )
        timings[Stage.LOCAL_PROPOSALS.value] = int((time.perf_counter() - t1) * 1000)

        _set_status(
            store,
            run_id,
            state=RunState.RUNNING,
            stage=Stage.GEMINI_FLASH,
            progress=55,
            timings=timings,
            stage_message="Initializing Gemini analysis",
            metrics=metrics,
        )
        t2 = time.perf_counter()
        gemini = GeminiClient(
            api_key=settings.gemini_api_key,
            flash_model=settings.flash_model,
            pro_model=settings.pro_model,
            logger=logger,
        )

        def progress_cb(stage_name: str, progress_pct: int, message: str, payload: Optional[dict[str, Any]] = None) -> None:
            stage = Stage.GEMINI_FLASH if stage_name == "GEMINI_FLASH" else Stage.GEMINI_PRO
            if payload:
                metrics.update(payload)
            _set_status(
                store,
                run_id,
                state=RunState.RUNNING,
                stage=stage,
                progress=max(55, min(progress_pct, 79)),
                timings=timings,
                stage_message=message,
                metrics=metrics,
            )

        flash_time_ms, pro_time_ms, gemini_metrics = gemini.analyze(
            run_dir=run_dir,
            video_path=Path(manifest["video_path"]),
            perf_config=perf_config,
            progress_cb=progress_cb,
        )
        metrics.update(gemini_metrics)
        timings[Stage.GEMINI_FLASH.value] = flash_time_ms
        timings[Stage.GEMINI_PRO.value] = pro_time_ms

        _set_status(
            store,
            run_id,
            state=RunState.RUNNING,
            stage=Stage.POSTPROCESS,
            progress=80,
            timings=timings,
            stage_message="Merging model outputs",
            metrics=metrics,
        )
        t3 = time.perf_counter()
        merge_results(run_dir=run_dir)
        timings[Stage.POSTPROCESS.value] = int((time.perf_counter() - t3) * 1000)
        trace_path = run_dir / "trace.json"
        if trace_path.exists():
            summary = read_json(trace_path).get("summary", {})
            metrics["packets_total"] = int(summary.get("packets_total", metrics.get("packets_total", 0)))
            metrics["packets_finalized"] = int(summary.get("final_events", metrics.get("packets_finalized", 0)))
            metrics["packets_dropped"] = int(summary.get("dropped_packets", metrics.get("packets_dropped", 0)))

        _set_status(
            store,
            run_id,
            state=RunState.READY_FOR_REVIEW,
            stage=Stage.READY_FOR_REVIEW,
            progress=95,
            timings=timings,
            stage_message="Ready for manual review",
            metrics=metrics,
        )
        logger.log("READY_FOR_REVIEW", "INFO", "stage_completed", "Pipeline ready for review")

    except Exception as exc:
        current_stage = store.get(run_id).status.stage
        logger.log(
            current_stage.value,
            "ERROR",
            "stage_failed",
            "Pipeline failed",
            error_code=f"{current_stage.value}_ERROR",
            error_detail=str(exc),
        )
        _set_status(
            store,
            run_id,
            state=RunState.FAILED,
            stage=current_stage,
            progress=store.get(run_id).status.progress_pct,
            timings=timings,
            stage_message="Pipeline failed",
            metrics=metrics,
            error=str(exc),
            failed_stage=current_stage,
        )


def export_run(run_id: str, store: RunStore, settings: Settings) -> Path:
    run_dir = settings.runs_dir / run_id
    path = export_case_pack(run_dir)
    status = store.get(run_id).status
    updated = status.model_copy(
        update={
            "state": RunState.EXPORTED,
            "stage": Stage.EXPORT,
            "progress_pct": 100,
            "stage_message": "Export completed",
        }
    )
    store.update_status(run_id, updated)
    return path
