from __future__ import annotations

import time
from pathlib import Path

import cv2

from backend.logging_utils.json_logger import RunLogger
from backend.utils.io import write_json


def ingest_video(video_path: Path, run_dir: Path, analysis_fps: int, logger: RunLogger) -> dict:
    stage = "INGEST"
    start = time.perf_counter()
    logger.log(stage, "INFO", "stage_started", "Starting ingest stage")

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        logger.log(stage, "ERROR", "stage_failed", "Unable to open video", error_code="INGEST_DECODE_ERROR")
        raise RuntimeError("Failed to open video")

    source_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = frame_count / source_fps if source_fps > 0 else 0
    sample_every = max(int(round(source_fps / max(analysis_fps, 1))), 1)

    frames_dir = run_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    frames = []
    frame_idx = 0
    sample_idx = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if frame_idx % sample_every == 0:
            ts_sec = frame_idx / source_fps
            frame_path = frames_dir / f"f_{sample_idx:05d}.jpg"
            cv2.imwrite(str(frame_path), frame)
            frames.append(
                {
                    "frame_idx": frame_idx,
                    "sample_idx": sample_idx,
                    "ts_sec": round(ts_sec, 3),
                    "path": str(frame_path),
                    "height": int(frame.shape[0]),
                    "width": int(frame.shape[1]),
                }
            )
            sample_idx += 1
        frame_idx += 1

    cap.release()

    manifest = {
        "video_path": str(video_path),
        "source_fps": source_fps,
        "analysis_fps": analysis_fps,
        "duration_sec": round(duration, 3),
        "frame_count": frame_count,
        "sample_count": len(frames),
        "frames": frames,
    }
    write_json(run_dir / "frames_manifest.json", manifest)

    elapsed = int((time.perf_counter() - start) * 1000)
    logger.log(
        stage,
        "INFO",
        "stage_completed",
        "Ingest complete",
        duration_ms=elapsed,
        frame_count=frame_count,
        sample_count=len(frames),
    )
    return manifest
