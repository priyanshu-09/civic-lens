from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError, as_completed
import json
import time
from pathlib import Path
from typing import Any
from typing import Callable
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
        timeout_sec: int,
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
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(self._client.models.generate_content, model=model, contents=[prompt, video_part], config=config)
            try:
                response = future.result(timeout=timeout_sec)
            except FuturesTimeoutError as exc:
                raise TimeoutError(f"{stage} request timed out after {timeout_sec}s") from exc
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

        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, dict):
            return parsed

        text = response.text or "{}"
        return json.loads(text)

    def _flash_fallback(self, candidate: Candidate) -> FlashEvent:
        return FlashEvent(
            candidate_id=candidate.candidate_id,
            is_relevant=candidate.score >= 0.55,
            event_type=candidate.event_type,
            confidence=round(min(0.95, max(0.2, candidate.score)), 3),
            start_time=candidate.start_s,
            end_time=candidate.end_s,
            plate_visible=False,
            violator_description="Vehicle detected in candidate window",
            needs_pro=candidate.score >= 0.7,
        )

    def _pro_fallback(self, idx: int, candidate: Candidate, flash_event: FlashEvent, reason: str) -> FinalEvent:
        return FinalEvent(
            event_id=f"evt_{idx + 1:03d}",
            event_type=flash_event.event_type,
            confidence=flash_event.confidence,
            risk_score=round(candidate.score * 100, 2),
            start_time=flash_event.start_time,
            end_time=flash_event.end_time,
            key_moments=[{"t": flash_event.start_time, "note": "Candidate activity starts"}],
            violator_description=flash_event.violator_description,
            plate_text=None,
            plate_candidates=[],
            explanation_short="Potential violation detected in candidate window. Manual review required.",
            uncertain=True,
            uncertainty_reason=reason,
        )

    def analyze(
        self,
        run_dir: Path,
        video_path: Path,
        perf_config: dict[str, Any],
        progress_cb: Optional[Callable[[str, int, str, Optional[dict[str, Any]]], None]] = None,
    ) -> tuple[int, int, dict[str, Any]]:
        all_candidates = [Candidate(**c) for c in read_json(run_dir / "candidates.json").get("candidates", [])]
        all_candidates.sort(key=lambda c: c.score, reverse=True)

        flash_limit = int(perf_config.get("gemini_flash_max_candidates", 4))
        pro_limit = int(perf_config.get("gemini_pro_max_candidates", 2))
        flash_concurrency = int(perf_config.get("gemini_flash_concurrency", 4))
        pro_concurrency = int(perf_config.get("gemini_pro_concurrency", 2))
        flash_timeout = int(perf_config.get("gemini_flash_timeout_sec", 30))
        pro_timeout = int(perf_config.get("gemini_pro_timeout_sec", 45))
        retry_attempts = int(perf_config.get("gemini_retry_attempts", 1))

        candidates = all_candidates[:flash_limit]
        metrics: dict[str, Any] = {
            "candidate_total": len(candidates),
            "flash_done": 0,
            "pro_queued": 0,
            "pro_done": 0,
            "flash_concurrency": flash_concurrency,
            "pro_concurrency": pro_concurrency,
        }

        flash_started = time.perf_counter()
        file_ref = None

        self.logger.log("GEMINI_FLASH", "INFO", "stage_started", "Starting Gemini Flash pass", candidate_count=len(candidates))
        if progress_cb:
            progress_cb("GEMINI_FLASH", 55, f"Preparing Flash pass for {len(candidates)} candidates", metrics)

        if self._client:
            self.logger.log("GEMINI_FLASH", "INFO", "file_upload_start", "Uploading video to Gemini")
            if progress_cb:
                progress_cb("GEMINI_FLASH", 56, "Uploading video for Gemini", metrics)
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

        def run_flash(candidate: Candidate, order_idx: int) -> tuple[int, Candidate, FlashEvent]:
            prompt = (
                "You are validating traffic violations in India. Return strictly valid JSON for the provided schema. "
                "If evidence is weak set is_relevant=false."
            )
            if not file_ref:
                return order_idx, candidate, self._flash_fallback(candidate)

            payload = None
            for attempt in range(retry_attempts + 1):
                try:
                    payload = self._generate(
                        model=self.flash_model,
                        file_ref=file_ref,
                        start_s=candidate.start_s,
                        end_s=candidate.end_s,
                        fps=2,
                        prompt=prompt,
                        schema=FLASH_SCHEMA,
                        stage="GEMINI_FLASH",
                        candidate_id=candidate.candidate_id,
                        timeout_sec=flash_timeout,
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
                    if attempt < retry_attempts:
                        time.sleep(2 ** attempt)
            if not payload:
                return order_idx, candidate, self._flash_fallback(candidate)
            return order_idx, candidate, FlashEvent(**payload)

        with ThreadPoolExecutor(max_workers=max(1, flash_concurrency)) as executor:
            futures = {}
            for idx, candidate in enumerate(candidates):
                self.logger.log(
                    "GEMINI_FLASH",
                    "INFO",
                    "candidate_started",
                    "Running Flash candidate",
                    candidate_id=candidate.candidate_id,
                    candidate_index=idx + 1,
                    candidate_total=len(candidates),
                )
                fut = executor.submit(run_flash, candidate, idx)
                futures[fut] = candidate.candidate_id

            flash_results: list[tuple[int, Candidate, FlashEvent]] = []
            total = max(1, len(futures))
            for done_idx, future in enumerate(as_completed(futures), start=1):
                order_idx, candidate, flash_event = future.result()
                flash_results.append((order_idx, candidate, flash_event))
                flash_events.append(flash_event)
                metrics["flash_done"] = done_idx
                self.logger.log(
                    "GEMINI_FLASH",
                    "INFO",
                    "candidate_completed",
                    "Flash candidate complete",
                    candidate_id=candidate.candidate_id,
                    confidence=flash_event.confidence,
                    relevant=flash_event.is_relevant,
                )
                if progress_cb:
                    pct = 57 + int((done_idx / total) * 13)
                    progress_cb("GEMINI_FLASH", pct, f"Flash analyzed {done_idx}/{len(candidates)} candidates", metrics)

        flash_elapsed = int((time.perf_counter() - flash_started) * 1000)

        flash_results.sort(key=lambda x: x[0])
        top_candidate_id = flash_results[0][1].candidate_id if flash_results else None

        pro_queue: list[tuple[float, int, Candidate, FlashEvent]] = []
        for order_idx, candidate, flash_event in flash_results:
            if not flash_event.is_relevant:
                continue
            severe = flash_event.event_type.value in {"RED_LIGHT_JUMP", "WRONG_SIDE_DRIVING"}
            ambiguous = 0.45 <= flash_event.confidence <= 0.8
            top_risk = candidate.candidate_id == top_candidate_id
            if not (severe or ambiguous or flash_event.plate_visible or top_risk):
                continue
            priority = candidate.score + (0.35 if severe else 0.0) + (0.2 if flash_event.plate_visible else 0.0) + (0.1 if ambiguous else 0.0)
            pro_queue.append((priority, order_idx, candidate, flash_event))

        pro_queue.sort(key=lambda x: x[0], reverse=True)
        queued = pro_queue[: max(0, pro_limit)]
        metrics["pro_queued"] = len(queued)

        self.logger.log(
            "GEMINI_FLASH",
            "INFO",
            "stage_completed",
            "Flash pass completed",
            duration_ms=flash_elapsed,
            event_count=len(flash_events),
            pro_candidate_count=len(queued),
        )

        pro_started = time.perf_counter()
        self.logger.log("GEMINI_PRO", "INFO", "stage_started", "Starting Gemini Pro pass", candidate_count=len(queued))
        if progress_cb:
            progress_cb("GEMINI_PRO", 70, f"Preparing Pro pass for {len(queued)} candidates", metrics)

        pro_events: list[FinalEvent] = []

        def run_pro(queue_idx: int, order_idx: int, candidate: Candidate, flash_event: FlashEvent) -> tuple[int, FinalEvent, str]:
            if not file_ref:
                return queue_idx, self._pro_fallback(order_idx, candidate, flash_event, "Fallback path used due to missing Gemini file upload."), candidate.candidate_id

            prompt = (
                "You are producing an evidence-only traffic violation record. "
                "If plate is unreadable, return plate_text as null. "
                "If uncertain set uncertain true with reason."
            )
            fps = 4 if candidate.event_type.value == "RECKLESS_DRIVING" else 2
            payload = None
            for attempt in range(retry_attempts + 1):
                try:
                    payload = self._generate(
                        model=self.pro_model,
                        file_ref=file_ref,
                        start_s=candidate.start_s,
                        end_s=candidate.end_s,
                        fps=fps,
                        prompt=prompt,
                        schema=PRO_SCHEMA,
                        stage="GEMINI_PRO",
                        candidate_id=candidate.candidate_id,
                        timeout_sec=pro_timeout,
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
                    if attempt < retry_attempts:
                        time.sleep(2 ** attempt)

            if not payload:
                return queue_idx, self._pro_fallback(order_idx, candidate, flash_event, "Fallback path used due to unavailable or failed Pro inference."), candidate.candidate_id

            event = FinalEvent(
                event_id=payload["event_id"],
                event_type=payload["event_type"],
                start_time=payload["start_time"],
                end_time=payload["end_time"],
                confidence=payload["confidence"],
                risk_score=payload["risk_score_gemini"],
                violator_description=payload["violator_description"],
                plate_text=payload.get("plate_text"),
                plate_candidates=payload.get("plate_candidates", []),
                key_moments=payload.get("key_moments", []),
                explanation_short=payload["explanation_short"],
                uncertain=payload.get("uncertain", False),
                uncertainty_reason=payload.get("uncertainty_reason"),
            )
            return queue_idx, event, candidate.candidate_id

        if queued:
            with ThreadPoolExecutor(max_workers=max(1, pro_concurrency)) as executor:
                futures = {}
                for queue_idx, (_priority, order_idx, candidate, flash_event) in enumerate(queued):
                    self.logger.log(
                        "GEMINI_PRO",
                        "INFO",
                        "candidate_started",
                        "Running Pro candidate",
                        candidate_id=candidate.candidate_id,
                        candidate_index=queue_idx + 1,
                        candidate_total=len(queued),
                    )
                    fut = executor.submit(run_pro, queue_idx, order_idx, candidate, flash_event)
                    futures[fut] = candidate.candidate_id

                total = max(1, len(futures))
                ordered: list[tuple[int, FinalEvent, str]] = []
                for done_idx, future in enumerate(as_completed(futures), start=1):
                    queue_idx, event, candidate_id = future.result()
                    ordered.append((queue_idx, event, candidate_id))
                    metrics["pro_done"] = done_idx
                    self.logger.log(
                        "GEMINI_PRO",
                        "INFO",
                        "candidate_completed",
                        "Pro candidate complete",
                        candidate_id=candidate_id,
                        event_id=event.event_id,
                    )
                    if progress_cb:
                        pct = 70 + int((done_idx / total) * 9)
                        progress_cb("GEMINI_PRO", pct, f"Pro analyzed {done_idx}/{len(queued)} candidates", metrics)

                ordered.sort(key=lambda x: x[0])
                pro_events = [row[1] for row in ordered]

        write_json(run_dir / "flash_events.json", {"events": [e.model_dump() for e in flash_events]})
        write_json(run_dir / "pro_events.json", {"events": [e.model_dump() for e in pro_events]})

        pro_elapsed = int((time.perf_counter() - pro_started) * 1000)
        self.logger.log(
            "GEMINI_PRO",
            "INFO",
            "stage_completed",
            "Pro pass completed",
            duration_ms=pro_elapsed,
            event_count=len(pro_events),
        )
        return flash_elapsed, pro_elapsed, metrics
