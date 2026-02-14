from __future__ import annotations

from enum import Enum
from typing import Any
from typing import Optional

from pydantic import BaseModel, Field


class RunState(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    FAILED = "FAILED"
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    EXPORTED = "EXPORTED"


class Stage(str, Enum):
    INGEST = "INGEST"
    LOCAL_PROPOSALS = "LOCAL_PROPOSALS"
    GEMINI_FLASH = "GEMINI_FLASH"
    GEMINI_PRO = "GEMINI_PRO"
    POSTPROCESS = "POSTPROCESS"
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    EXPORT = "EXPORT"


class ViolationType(str, Enum):
    NO_HELMET = "NO_HELMET"
    RED_LIGHT_JUMP = "RED_LIGHT_JUMP"
    WRONG_SIDE_DRIVING = "WRONG_SIDE_DRIVING"
    RECKLESS_DRIVING = "RECKLESS_DRIVING"


class Candidate(BaseModel):
    candidate_id: str
    event_type: ViolationType
    start_s: float
    end_s: float
    score: float = Field(ge=0, le=1)
    track_ids: list[int] = Field(default_factory=list)
    reason_codes: list[str] = Field(default_factory=list)
    feature_snapshot: dict[str, float] = Field(default_factory=dict)


class FlashEvent(BaseModel):
    candidate_id: str
    is_relevant: bool
    event_type: ViolationType
    confidence: float = Field(ge=0, le=1)
    start_time: float
    end_time: float
    plate_visible: bool = False
    violator_description: str = ""
    needs_pro: bool = False


class FinalEvent(BaseModel):
    event_id: str
    event_type: ViolationType
    start_time: float
    end_time: float
    confidence: float = Field(ge=0, le=1)
    risk_score: float = Field(ge=0, le=100)
    violator_description: str
    plate_text: Optional[str] = None
    plate_candidates: list[str] = Field(default_factory=list)
    evidence_frames: list[str] = Field(default_factory=list)
    evidence_clip_path: Optional[str] = None
    key_moments: list[dict[str, Any]] = Field(default_factory=list)
    explanation_short: str
    uncertain: bool = False
    uncertainty_reason: Optional[str] = None


class ReviewDecision(BaseModel):
    decision: str
    reviewer_notes: str = ""
    include_plate: bool = False


class RunStatus(BaseModel):
    run_id: str
    state: RunState
    stage: Stage
    progress_pct: int = Field(ge=0, le=100)
    stage_message: Optional[str] = None
    failed_stage: Optional[Stage] = None
    error_message: Optional[str] = None
    timings_ms: dict[str, int] = Field(default_factory=dict)


class RunRecord(BaseModel):
    run_id: str
    video_path: str
    roi_config_path: str
    status: RunStatus
