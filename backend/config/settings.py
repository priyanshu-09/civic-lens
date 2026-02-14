from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class Settings:
    runs_dir: Path
    gemini_api_key: Optional[str]
    max_gemini_concurrency: int
    default_analysis_fps: int
    flash_model: str
    pro_model: str



def load_settings() -> Settings:
    runs_dir = Path(os.getenv("RUNS_DIR", "data/runs")).resolve()
    runs_dir.mkdir(parents=True, exist_ok=True)
    return Settings(
        runs_dir=runs_dir,
        gemini_api_key=os.getenv("GEMINI_API_KEY"),
        max_gemini_concurrency=int(os.getenv("MAX_GEMINI_CONCURRENCY", "2")),
        default_analysis_fps=int(os.getenv("DEFAULT_ANALYSIS_FPS", "4")),
        flash_model=os.getenv("GEMINI_FLASH_MODEL", "gemini-3-flash-preview"),
        pro_model=os.getenv("GEMINI_PRO_MODEL", "gemini-3-pro-preview"),
    )
