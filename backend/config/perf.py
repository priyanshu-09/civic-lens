from __future__ import annotations

from pathlib import Path
from typing import Any

from backend.utils.io import read_json


DEFAULT_PERF_CONFIG: dict[str, Any] = {
    "pipeline_mode": "balanced",
    "gemini_flash_max_candidates": 14,
    "gemini_pro_max_candidates": 8,
    "gemini_flash_concurrency": 4,
    "gemini_pro_concurrency": 2,
    "gemini_flash_timeout_sec": 30,
    "gemini_pro_timeout_sec": 45,
    "gemini_retry_attempts": 1,
    "flash_min_local_score": 0.5,
    "pro_uncertain_conf_low": 0.45,
    "pro_uncertain_conf_high": 0.82,
    "analysis_fps_short": 4,
    "analysis_fps_long": 2,
    "long_video_threshold_sec": 90,
    "local_downscale_long_edge": 640,
}


def load_perf_config(path: Path) -> dict[str, Any]:
    cfg = dict(DEFAULT_PERF_CONFIG)
    if path.exists():
        try:
            payload = read_json(path)
            if isinstance(payload, dict):
                cfg.update(payload)
        except Exception:
            # Keep defaults if config file is malformed.
            pass

    cfg["gemini_flash_max_candidates"] = max(1, int(cfg["gemini_flash_max_candidates"]))
    cfg["gemini_pro_max_candidates"] = max(0, int(cfg["gemini_pro_max_candidates"]))
    cfg["gemini_flash_concurrency"] = max(1, int(cfg["gemini_flash_concurrency"]))
    cfg["gemini_pro_concurrency"] = max(1, int(cfg["gemini_pro_concurrency"]))
    cfg["gemini_flash_timeout_sec"] = max(10, int(cfg["gemini_flash_timeout_sec"]))
    cfg["gemini_pro_timeout_sec"] = max(10, int(cfg["gemini_pro_timeout_sec"]))
    cfg["gemini_retry_attempts"] = max(0, int(cfg["gemini_retry_attempts"]))
    cfg["flash_min_local_score"] = min(1.0, max(0.0, float(cfg["flash_min_local_score"])))
    cfg["pro_uncertain_conf_low"] = min(1.0, max(0.0, float(cfg["pro_uncertain_conf_low"])))
    cfg["pro_uncertain_conf_high"] = min(1.0, max(0.0, float(cfg["pro_uncertain_conf_high"])))
    if cfg["pro_uncertain_conf_low"] > cfg["pro_uncertain_conf_high"]:
        cfg["pro_uncertain_conf_low"], cfg["pro_uncertain_conf_high"] = (
            cfg["pro_uncertain_conf_high"],
            cfg["pro_uncertain_conf_low"],
        )
    cfg["analysis_fps_short"] = max(1, int(cfg["analysis_fps_short"]))
    cfg["analysis_fps_long"] = max(1, int(cfg["analysis_fps_long"]))
    cfg["long_video_threshold_sec"] = max(1, int(cfg["long_video_threshold_sec"]))
    cfg["local_downscale_long_edge"] = max(240, int(cfg["local_downscale_long_edge"]))
    return cfg
