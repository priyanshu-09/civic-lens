from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any
from typing import Optional

from backend.gemini.schemas import FLASH_SCHEMA, PRO_SCHEMA
from backend.logging_utils.json_logger import RunLogger
from backend.models.types import Candidate, FlashEvent, FinalEvent
from backend.utils.io import read_json, write_json


class GeminiClient:
    def __init__(self, api_key: Optional[str], flash_model: str, pro_model: str, logger: RunLogger) -> None:
        self.api_key = api_key
        self.flash_model = flash_model
        self.pro_model = pro_model
        self.logger = logger
        self._client = None
        self._types = None
        if api_key:
            try:
                from google import genai
                from google.genai import types

                self._client = genai.Client(api_key=api_key)
                self._types = types
            except Exception as exc:  # pragma: no cover - import path variability
                self.logger.log("GEMINI_FLASH", "ERROR", "gemini_init_error", "Gemini SDK init failed", error_detail=str(exc))

    def _upload_video(self, video_path: Path) -> Any:
        if not self._client:
            return None
        uploaded = self._client.files.upload(file=str(video_path))
        for _ in range(30):
            current = self._client.files.get(name=uploaded.name)
            state = getattr(current, "state", None)
            if str(state).upper().endswith("ACTIVE"):
                return current
            time.sleep(1)
        raise RuntimeError("Gemini file did not become active")

    def _generate(
        self,
        *,
        model: str,
        file_ref: Any,
        start_s: float,
        end_s: float,
        fps: int,
        prompt: str,
        schema: dict[str, Any],
        stage: str,
        candidate_id: str,
    ) -> dict[str, Any]:
        if not self._client or not self._types or not file_ref:
            raise RuntimeError("Gemini client unavailable")

        t = self._types
        video_part = t.Part(
            file_data=t.FileData(file_uri=file_ref.uri, mime_type=file_ref.mime_type),
            video_metadata=t.VideoMetadata(start_offset=f"{max(start_s, 0.0)}s", end_offset=f"{max(end_s, 0.0)}s", fps=fps),
        )

        config = t.GenerateContentConfig(
            response_mime_type="application/json",
            response_json_schema=schema,
            temperature=0.1,
        )

        start = time.perf_counter()
        response = self._client.models.generate_content(model=model, contents=[prompt, video_part], config=config)
        latency = int((time.perf_counter() - start) * 1000)
        self.logger.log(
            stage,
            "INFO",
            "gemini_response",
            "Gemini call completed",
            candidate_id=candidate_id,
            model=model,
            duration_ms=latency,
        )

        text = response.text or "{}"
        return json.loads(text)

    def analyze(self, run_dir: Path, video_path: Path, max_pro: int = 8) -> tuple[list[FlashEvent], list[FinalEvent]]:
        candidates = [Candidate(**c) for c in read_json(run_dir / "candidates.json").get("candidates", [])]
        file_ref = None

        if self._client:
            self.logger.log("GEMINI_FLASH", "INFO", "file_upload_start", "Uploading video to Gemini")
            try:
                file_ref = self._upload_video(video_path)
                self.logger.log(
                    "GEMINI_FLASH",
                    "INFO",
                    "file_upload_done",
                    "Video ready",
                    file_uri=getattr(file_ref, "uri", None),
                )
            except Exception as exc:
                self.logger.log(
                    "GEMINI_FLASH",
                    "ERROR",
                    "stage_failed",
                    "Failed to upload or activate Gemini file",
                    error_code="GEMINI_UPLOAD_ERROR",
                    error_detail=str(exc),
                )

        flash_events: list[FlashEvent] = []
        pro_events: list[FinalEvent] = []

        for idx, candidate in enumerate(candidates):
            prompt = (
                "You are validating traffic violations in India. Return strictly valid JSON for the provided schema. "
                "If evidence is weak set is_relevant=false."
            )
            flash_payload = None
            if file_ref:
                for attempt in range(3):
                    try:
                        flash_payload = self._generate(
                            model=self.flash_model,
                            file_ref=file_ref,
                            start_s=candidate.start_s,
                            end_s=candidate.end_s,
                            fps=2,
                            prompt=prompt,
                            schema=FLASH_SCHEMA,
                            stage="GEMINI_FLASH",
                            candidate_id=candidate.candidate_id,
                        )
                        break
                    except Exception as exc:
                        self.logger.log(
                            "GEMINI_FLASH",
                            "ERROR",
                            "gemini_retry",
                            "Flash call failed",
                            candidate_id=candidate.candidate_id,
                            retry_count=attempt + 1,
                            error_detail=str(exc),
                        )
                        time.sleep(2 ** attempt)

            if not flash_payload:
                flash_payload = {
                    "candidate_id": candidate.candidate_id,
                    "is_relevant": candidate.score >= 0.55,
                    "event_type": candidate.event_type.value,
                    "confidence": round(min(0.95, max(0.2, candidate.score)), 3),
                    "start_time": candidate.start_s,
                    "end_time": candidate.end_s,
                    "plate_visible": False,
                    "violator_description": "Vehicle detected in candidate window",
                    "needs_pro": candidate.score >= 0.7,
                }

            flash_event = FlashEvent(**flash_payload)
            flash_events.append(flash_event)

            should_escalate = flash_event.is_relevant and (
                flash_event.confidence >= 0.65 or flash_event.needs_pro or candidate.event_type.value == "RECKLESS_DRIVING"
            )
            if not should_escalate or len(pro_events) >= max_pro:
                continue

            pro_payload = None
            if file_ref:
                pro_prompt = (
                    "You are producing an evidence-only traffic violation record. "
                    "If plate is unreadable, return plate_text as null. "
                    "If uncertain set uncertain true with reason."
                )
                fps = 4 if candidate.event_type.value == "RECKLESS_DRIVING" else 2
                for attempt in range(3):
                    try:
                        pro_payload = self._generate(
                            model=self.pro_model,
                            file_ref=file_ref,
                            start_s=candidate.start_s,
                            end_s=candidate.end_s,
                            fps=fps,
                            prompt=pro_prompt,
                            schema=PRO_SCHEMA,
                            stage="GEMINI_PRO",
                            candidate_id=candidate.candidate_id,
                        )
                        break
                    except Exception as exc:
                        self.logger.log(
                            "GEMINI_PRO",
                            "ERROR",
                            "gemini_retry",
                            "Pro call failed",
                            candidate_id=candidate.candidate_id,
                            retry_count=attempt + 1,
                            error_detail=str(exc),
                        )
                        time.sleep(2 ** attempt)

            if not pro_payload:
                pro_payload = {
                    "event_id": f"evt_{idx + 1:03d}",
                    "event_type": flash_event.event_type.value,
                    "confidence": flash_event.confidence,
                    "risk_score_gemini": round(candidate.score * 100, 2),
                    "start_time": flash_event.start_time,
                    "end_time": flash_event.end_time,
                    "key_moments": [{"t": flash_event.start_time, "note": "Candidate activity starts"}],
                    "violator_description": flash_event.violator_description,
                    "plate_text": None,
                    "plate_candidates": [],
                    "explanation_short": "Potential violation detected in candidate window. Manual review required.",
                    "uncertain": True,
                    "uncertainty_reason": "Fallback path used due to unavailable or failed Pro inference.",
                }

            pro_events.append(
                FinalEvent(
                    event_id=pro_payload["event_id"],
                    event_type=pro_payload["event_type"],
                    start_time=pro_payload["start_time"],
                    end_time=pro_payload["end_time"],
                    confidence=pro_payload["confidence"],
                    risk_score=pro_payload["risk_score_gemini"],
                    violator_description=pro_payload["violator_description"],
                    plate_text=pro_payload.get("plate_text"),
                    plate_candidates=pro_payload.get("plate_candidates", []),
                    key_moments=pro_payload.get("key_moments", []),
                    explanation_short=pro_payload["explanation_short"],
                    uncertain=pro_payload.get("uncertain", False),
                    uncertainty_reason=pro_payload.get("uncertainty_reason"),
                )
            )

        write_json(run_dir / "flash_events.json", {"events": [e.model_dump() for e in flash_events]})
        write_json(run_dir / "pro_events.json", {"events": [e.model_dump() for e in pro_events]})
        return flash_events, pro_events
