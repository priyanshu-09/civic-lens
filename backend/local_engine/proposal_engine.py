from __future__ import annotations

import time
from collections import defaultdict
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from backend.local_engine.geometry import denormalize_polygon, polygon_mask
from backend.logging_utils.json_logger import RunLogger
from backend.models.types import Candidate, ViolationType
from backend.utils.io import read_json, write_json


def _load_config(config_path: Path) -> dict[str, Any]:
    default = {
        "analysis_fps": 4,
        "k_helmet": 6,
        "k_red": 3,
        "k_wrong": 5,
        "risk_threshold": 0.6,
        "max_candidates_total": 12,
        "max_candidates_per_type": 4,
        "min_same_type_gap_seconds": 2.0,
        "red_threshold": 1.4,
        "motion_threshold": 25.0,
        "wrong_flow_threshold": -0.25,
    }
    if config_path.exists():
        payload = read_json(config_path)
        default.update(payload)
    return default


def _group_runs(indices: list[int], k_required: int) -> list[tuple[int, int]]:
    if not indices:
        return []
    runs: list[tuple[int, int]] = []
    start = indices[0]
    prev = indices[0]
    for idx in indices[1:]:
        if idx == prev + 1:
            prev = idx
        else:
            if prev - start + 1 >= k_required:
                runs.append((start, prev))
            start = idx
            prev = idx
    if prev - start + 1 >= k_required:
        runs.append((start, prev))
    return runs


def run_local_proposals(
    run_id: str,
    run_dir: Path,
    roi_config_path: Path,
    proposal_config_path: Path,
    logger: RunLogger,
) -> dict[str, Any]:
    stage = "LOCAL_PROPOSALS"
    started = time.perf_counter()
    logger.log(stage, "INFO", "stage_started", "Starting local proposal engine")

    manifest = read_json(run_dir / "frames_manifest.json")
    frames = manifest["frames"]
    if not frames:
        logger.log(stage, "WARNING", "stage_completed", "No frames in manifest", duration_ms=0)
        payload = {"run_id": run_id, "candidates": []}
        write_json(run_dir / "candidates.json", payload)
        return payload

    roi_cfg = read_json(roi_config_path)
    cfg = _load_config(proposal_config_path)

    h = frames[0]["height"]
    w = frames[0]["width"]

    signal_poly = denormalize_polygon(roi_cfg.get("signal_roi_polygon", []), w, h)
    wrong_poly = denormalize_polygon(roi_cfg.get("wrong_side_lane_polygon", []), w, h)
    stop_poly = denormalize_polygon(roi_cfg.get("stop_line_polygon", []), w, h)
    expected_dir = np.array(roi_cfg.get("expected_direction_vector", [1.0, 0.0]), dtype=np.float32)
    if np.linalg.norm(expected_dir) == 0:
        expected_dir = np.array([1.0, 0.0], dtype=np.float32)
    expected_dir = expected_dir / np.linalg.norm(expected_dir)

    signal_mask = polygon_mask((h, w), signal_poly)
    wrong_mask = polygon_mask((h, w), wrong_poly)
    stop_mask = polygon_mask((h, w), stop_poly)

    prev_gray = None
    red_hits: list[int] = []
    motion_hits: list[int] = []
    wrong_hits: list[int] = []
    reckless_hits: list[int] = []
    helmet_hits: list[int] = []

    feature_snapshots: dict[int, dict[str, float]] = defaultdict(dict)

    bg_sub = cv2.createBackgroundSubtractorMOG2(history=60, varThreshold=32, detectShadows=False)

    for i, meta in enumerate(frames):
        frame = cv2.imread(meta["path"])
        if frame is None:
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        fg = bg_sub.apply(frame)

        red_score = 0.0
        if signal_mask.any():
            signal_pixels = frame[signal_mask > 0]
            if len(signal_pixels) > 0:
                b_mean, g_mean, r_mean = np.mean(signal_pixels, axis=0)
                red_score = float((r_mean + 1.0) / (g_mean + b_mean + 1.0))
                if red_score >= cfg["red_threshold"]:
                    red_hits.append(i)

        motion_score = 0.0
        if prev_gray is not None:
            diff = cv2.absdiff(gray, prev_gray)
            motion_score = float(np.mean(diff))
            if motion_score >= cfg["motion_threshold"]:
                motion_hits.append(i)

        flow_cos = 0.0
        if prev_gray is not None and wrong_mask.any():
            flow = cv2.calcOpticalFlowFarneback(prev_gray, gray, None, 0.5, 2, 15, 3, 5, 1.2, 0)
            vx = flow[:, :, 0]
            vy = flow[:, :, 1]
            m = wrong_mask > 0
            if np.any(m):
                avg_vec = np.array([float(np.mean(vx[m])), float(np.mean(vy[m]))], dtype=np.float32)
                mag = np.linalg.norm(avg_vec)
                if mag > 1e-4:
                    avg_vec = avg_vec / mag
                    flow_cos = float(np.dot(avg_vec, expected_dir))
                    if flow_cos <= cfg["wrong_flow_threshold"]:
                        wrong_hits.append(i)

        fg_ratio = float(np.count_nonzero(fg) / fg.size)
        reckless_score = min(1.0, (motion_score / 80.0) * 0.5 + fg_ratio * 1.2 + max(0.0, -flow_cos) * 0.3)
        if reckless_score >= cfg["risk_threshold"]:
            reckless_hits.append(i)

        central = fg[int(h * 0.3) : int(h * 0.8), int(w * 0.3) : int(w * 0.7)]
        central_ratio = float(np.count_nonzero(central) / central.size) if central.size else 0.0
        if central_ratio > 0.2 and motion_score > (cfg["motion_threshold"] * 0.6):
            helmet_hits.append(i)

        feature_snapshots[i] = {
            "red_score": round(red_score, 4),
            "motion_score": round(motion_score, 4),
            "flow_cos": round(flow_cos, 4),
            "fg_ratio": round(fg_ratio, 4),
            "reckless_score": round(reckless_score, 4),
        }
        prev_gray = gray

    candidates: list[Candidate] = []
    cid = 1

    def add_candidates(event_type: ViolationType, runs: list[tuple[int, int]], reason_codes: list[str], score_hint: float) -> None:
        nonlocal cid
        for start_i, end_i in runs:
            start_ts = max(0.0, float(frames[start_i]["ts_sec"] - 1.0))
            end_ts = min(float(manifest["duration_sec"]), float(frames[end_i]["ts_sec"] + 1.0))
            peak_i = min(max((start_i + end_i) // 2, 0), len(frames) - 1)
            snap = feature_snapshots.get(peak_i, {})
            score = min(1.0, max(0.0, score_hint + float(snap.get("reckless_score", 0.0)) * 0.25))
            candidates.append(
                Candidate(
                    candidate_id=f"cand_{cid:03d}",
                    event_type=event_type,
                    start_s=round(start_ts, 3),
                    end_s=round(end_ts, 3),
                    score=round(score, 3),
                    track_ids=[],
                    reason_codes=reason_codes,
                    feature_snapshot=snap,
                )
            )
            cid += 1

    add_candidates(
        ViolationType.RED_LIGHT_JUMP,
        _group_runs(sorted(set(red_hits).intersection(set(motion_hits))), cfg["k_red"]),
        ["RED_STATE_CONFIRMED", "STOP_LINE_ACTIVITY"],
        0.58,
    )
    add_candidates(
        ViolationType.WRONG_SIDE_DRIVING,
        _group_runs(wrong_hits, cfg["k_wrong"]),
        ["DIRECTION_OPPOSITE", "LANE_ROI_MATCH"],
        0.62,
    )
    add_candidates(
        ViolationType.NO_HELMET,
        _group_runs(helmet_hits, cfg["k_helmet"]),
        ["BIKE_RIDER_PROXY", "HELMET_MISSING_PROXY"],
        0.52,
    )
    add_candidates(
        ViolationType.RECKLESS_DRIVING,
        _group_runs(reckless_hits, 4),
        ["MOTION_SPIKE", "CONFLICT_RISK"],
        0.64,
    )

    candidates.sort(key=lambda x: x.score, reverse=True)

    per_type_counts: dict[ViolationType, int] = defaultdict(int)
    pruned: list[Candidate] = []
    for cand in candidates:
        if len(pruned) >= int(cfg["max_candidates_total"]):
            break
        if per_type_counts[cand.event_type] >= int(cfg["max_candidates_per_type"]):
            continue

        keep = True
        for existing in pruned:
            if existing.event_type != cand.event_type:
                continue
            overlap = max(0.0, min(existing.end_s, cand.end_s) - max(existing.start_s, cand.start_s))
            shorter = min(existing.end_s - existing.start_s, cand.end_s - cand.start_s)
            if shorter > 0 and overlap / shorter > 0.4:
                keep = False
                break
        if keep:
            pruned.append(cand)
            per_type_counts[cand.event_type] += 1

    payload = {"run_id": run_id, "candidates": [c.model_dump() for c in pruned]}
    write_json(run_dir / "candidates.json", payload)

    elapsed = int((time.perf_counter() - started) * 1000)
    logger.log(
        stage,
        "INFO",
        "stage_completed",
        "Local proposals completed",
        duration_ms=elapsed,
        candidate_count=len(pruned),
    )
    if not pruned:
        logger.log(stage, "WARNING", "candidate_empty_warning", "No candidates generated", error_code="CANDIDATE_EMPTY_WARNING")
    return payload
