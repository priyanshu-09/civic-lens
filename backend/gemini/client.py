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


MODE_PRESETS = {
    "fast": {"gemini_flash_max_candidates": 4, "gemini_pro_max_candidates": 2},
    "balanced": {"gemini_flash_max_candidates": 6, "gemini_pro_max_candidates": 3},
    "high_recall": {"gemini_flash_max_candidates": 12, "gemini_pro_max_candidates": 6},
}


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
        packet_id: str,
        timeout_sec: int,
    ) -> tuple[dict[str, Any], int]:
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
            packet_id=packet_id,
            model=model,
            duration_ms=latency,
        )

        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, dict):
            return parsed, latency

        text = response.text or "{}"
        return json.loads(text), latency

    def _flash_fallback(self, candidate: Candidate) -> FlashEvent:
        return FlashEvent(
            packet_id=candidate.packet_id,
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
            event_id=f"evt_{idx + 1:03d}_{candidate.packet_id}",
            packet_id=candidate.packet_id,
            source_stage="PRO_FINAL",
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
            evidence_frames=[],
            report_images=[],
            evidence_clip_path=None,
        )

    def _resolve_mode_config(self, perf_config: dict[str, Any]) -> dict[str, Any]:
        mode = str(perf_config.get("pipeline_mode", "balanced"))
        cfg = dict(perf_config)
        preset = MODE_PRESETS.get(mode)
        if preset:
            cfg.update(preset)
        cfg["pipeline_mode"] = mode
        return cfg

    def _select_flash_candidates(self, candidates: list[Candidate], flash_limit: int) -> list[Candidate]:
        if not candidates:
            return []
        by_score = sorted(candidates, key=lambda c: c.score, reverse=True)
        selected: list[Candidate] = []
        selected_ids: set[str] = set()

        # Ensure at least top packet per local type when possible.
        top_per_type: dict[str, Candidate] = {}
        for cand in by_score:
            t = cand.event_type.value
            if t not in top_per_type:
                top_per_type[t] = cand
        for cand in top_per_type.values():
            if len(selected) >= flash_limit:
                break
            if cand.packet_id in selected_ids:
                continue
            selected.append(cand)
            selected_ids.add(cand.packet_id)

        for cand in by_score:
            if len(selected) >= flash_limit:
                break
            if cand.packet_id in selected_ids:
                continue
            selected.append(cand)
            selected_ids.add(cand.packet_id)
        return selected

    def analyze(
        self,
        run_dir: Path,
        video_path: Path,
        perf_config: dict[str, Any],
        progress_cb: Optional[Callable[[str, int, str, Optional[dict[str, Any]]], None]] = None,
    ) -> tuple[int, int, dict[str, Any]]:
        resolved_perf = self._resolve_mode_config(perf_config)
        raw_candidate_payload = read_json(run_dir / "candidates.json").get("candidates", [])
        raw_candidates: list[Candidate] = []
        for idx, c in enumerate(raw_candidate_payload, start=1):
            payload = dict(c)
            payload.setdefault("packet_id", payload.get("candidate_id", f"pkt_legacy_{idx:03d}"))
            payload.setdefault("anchor_frames", [])
            raw_candidates.append(Candidate(**payload))
        raw_candidates.sort(key=lambda c: c.score, reverse=True)
        packet_payload = read_json(run_dir / "packets.json") if (run_dir / "packets.json").exists() else {"packets": []}
        packets: list[dict[str, Any]] = packet_payload.get("packets", [])

        packet_by_id = {p.get("packet_id"): p for p in packets}

        flash_limit = int(resolved_perf.get("gemini_flash_max_candidates", 6))
        pro_limit = int(resolved_perf.get("gemini_pro_max_candidates", 3))
        flash_concurrency = int(resolved_perf.get("gemini_flash_concurrency", 4))
        pro_concurrency = int(resolved_perf.get("gemini_pro_concurrency", 2))
        flash_timeout = int(resolved_perf.get("gemini_flash_timeout_sec", 30))
        pro_timeout = int(resolved_perf.get("gemini_pro_timeout_sec", 45))
        retry_attempts = int(resolved_perf.get("gemini_retry_attempts", 1))

        candidates = self._select_flash_candidates(raw_candidates, flash_limit)
        selected_packet_ids = {c.packet_id for c in candidates}

        metrics: dict[str, Any] = {
            "pipeline_mode": resolved_perf.get("pipeline_mode", "balanced"),
            "packets_total": len(raw_candidates),
            "packets_sent_flash": len(candidates),
            "packets_sent_pro": 0,
            "packets_finalized": 0,
            "packets_dropped": 0,
            "flash_done": 0,
            "pro_done": 0,
            "flash_errors": 0,
            "pro_errors": 0,
            "flash_concurrency": flash_concurrency,
            "pro_concurrency": pro_concurrency,
            "candidate_total": len(candidates),
            "pro_queued": 0,
        }

        # Initialize routing reasons for non-selected packets.
        for cand in raw_candidates:
            pkt = packet_by_id.get(cand.packet_id)
            if not pkt:
                continue
            routing = pkt.setdefault("routing", {})
            routing.setdefault("routing_reason", [])
            routing["sent_to_flash"] = cand.packet_id in selected_packet_ids
            routing["sent_to_pro"] = False
            if cand.packet_id not in selected_packet_ids:
                routing["routing_reason"].append("not_in_flash_top_k")

        flash_started = time.perf_counter()
        file_ref = None

        self.logger.log("GEMINI_FLASH", "INFO", "stage_started", "Starting Gemini Flash pass", packet_count=len(candidates))
        if progress_cb:
            progress_cb("GEMINI_FLASH", 55, f"Preparing Flash pass for {len(candidates)} packets", metrics)

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
        flash_decisions: list[dict[str, Any]] = []

        def run_flash(candidate: Candidate, order_idx: int) -> tuple[int, Candidate, FlashEvent, dict[str, Any]]:
            prompt = (
                "You are validating Indian traffic incidents. Return strict JSON. "
                f"Use packet_id exactly as provided: {candidate.packet_id}. "
                f"Candidate id is {candidate.candidate_id}. "
                "If weak evidence, set is_relevant=false."
            )
            decision = {
                "packet_id": candidate.packet_id,
                "candidate_id": candidate.candidate_id,
                "model": self.flash_model,
                "request_window_start_s": candidate.start_s,
                "request_window_end_s": candidate.end_s,
                "status": "fallback",
                "latency_ms": 0,
                "error_detail": None,
                "response": None,
            }

            if not file_ref:
                fallback = self._flash_fallback(candidate)
                decision["response"] = fallback.model_dump()
                return order_idx, candidate, fallback, decision

            payload = None
            latency_ms = 0
            for attempt in range(retry_attempts + 1):
                try:
                    payload, latency_ms = self._generate(
                        model=self.flash_model,
                        file_ref=file_ref,
                        start_s=candidate.start_s,
                        end_s=candidate.end_s,
                        fps=2,
                        prompt=prompt,
                        schema=FLASH_SCHEMA,
                        stage="GEMINI_FLASH",
                        packet_id=candidate.packet_id,
                        timeout_sec=flash_timeout,
                    )
                    break
                except Exception as exc:
                    self.logger.log(
                        "GEMINI_FLASH",
                        "ERROR",
                        "gemini_retry",
                        "Flash call failed",
                        packet_id=candidate.packet_id,
                        retry_count=attempt + 1,
                        error_detail=str(exc),
                    )
                    if attempt < retry_attempts:
                        time.sleep(2 ** attempt)
            if not payload:
                metrics["flash_errors"] += 1
                fallback = self._flash_fallback(candidate)
                decision["status"] = "fallback"
                decision["error_detail"] = "flash_failed_or_timeout"
                decision["response"] = fallback.model_dump()
                return order_idx, candidate, fallback, decision

            returned_packet = payload.get("packet_id")
            if returned_packet != candidate.packet_id:
                metrics["flash_errors"] += 1
                fallback = self._flash_fallback(candidate)
                decision["status"] = "fallback"
                decision["error_detail"] = "SCHEMA_PACKET_MISMATCH"
                decision["response"] = fallback.model_dump()
                return order_idx, candidate, fallback, decision

            payload["candidate_id"] = candidate.candidate_id
            payload["packet_id"] = candidate.packet_id
            try:
                event = FlashEvent(**payload)
                decision["status"] = "ok"
                decision["latency_ms"] = latency_ms
                decision["response"] = event.model_dump()
                return order_idx, candidate, event, decision
            except Exception:
                metrics["flash_errors"] += 1
                fallback = self._flash_fallback(candidate)
                decision["status"] = "fallback"
                decision["error_detail"] = "flash_schema_validation_failed"
                decision["response"] = fallback.model_dump()
                return order_idx, candidate, fallback, decision

        with ThreadPoolExecutor(max_workers=max(1, flash_concurrency)) as executor:
            futures = {}
            for idx, candidate in enumerate(candidates):
                self.logger.log(
                    "GEMINI_FLASH",
                    "INFO",
                    "packet_started",
                    "Running Flash packet",
                    packet_id=candidate.packet_id,
                    packet_index=idx + 1,
                    packet_total=len(candidates),
                )
                fut = executor.submit(run_flash, candidate, idx)
                futures[fut] = candidate.packet_id

            flash_results: list[tuple[int, Candidate, FlashEvent, dict[str, Any]]] = []
            total = max(1, len(futures))
            for done_idx, future in enumerate(as_completed(futures), start=1):
                order_idx, candidate, flash_event, decision = future.result()
                flash_results.append((order_idx, candidate, flash_event, decision))
                flash_events.append(flash_event)
                flash_decisions.append(decision)
                metrics["flash_done"] = done_idx
                self.logger.log(
                    "GEMINI_FLASH",
                    "INFO",
                    "packet_completed",
                    "Flash packet complete",
                    packet_id=candidate.packet_id,
                    confidence=flash_event.confidence,
                    relevant=flash_event.is_relevant,
                    status=decision["status"],
                )
                if progress_cb:
                    pct = 57 + int((done_idx / total) * 13)
                    progress_cb("GEMINI_FLASH", pct, f"Flash analyzed {done_idx}/{len(candidates)} packets", metrics)

        flash_elapsed = int((time.perf_counter() - flash_started) * 1000)

        flash_results.sort(key=lambda x: x[0])
        top_packet_id = flash_results[0][1].packet_id if flash_results else None

        pro_queue: list[tuple[float, int, Candidate, FlashEvent, list[str]]] = []
        for order_idx, candidate, flash_event, decision in flash_results:
            pkt = packet_by_id.get(candidate.packet_id)
            routing = pkt.setdefault("routing", {}) if pkt else {}
            reasons = []

            if not flash_event.is_relevant:
                reasons.append("flash_not_relevant")
                routing.setdefault("routing_reason", []).append("flash_not_relevant")
                continue

            local_type = candidate.event_type.value
            severe = flash_event.event_type.value in {"RED_LIGHT_JUMP", "WRONG_SIDE_DRIVING"}
            ambiguous = 0.45 <= flash_event.confidence <= 0.8
            top_risk = candidate.packet_id == top_packet_id
            disagreement = local_type != flash_event.event_type.value

            if severe:
                reasons.append("severe_event_type")
            if ambiguous:
                reasons.append("flash_confidence_ambiguous")
            if flash_event.plate_visible:
                reasons.append("plate_visible")
            if top_risk:
                reasons.append("top_local_risk")
            if disagreement:
                reasons.append("local_flash_disagreement")

            if not reasons:
                routing.setdefault("routing_reason", []).append("did_not_meet_pro_policy")
                continue

            priority = candidate.score + (0.35 if severe else 0.0) + (0.2 if flash_event.plate_visible else 0.0) + (0.1 if ambiguous else 0.0)
            pro_queue.append((priority, order_idx, candidate, flash_event, reasons))

        pro_queue.sort(key=lambda x: x[0], reverse=True)
        queued = pro_queue[: max(0, pro_limit)]
        queued_ids = {row[2].packet_id for row in queued}
        metrics["pro_queued"] = len(queued)
        metrics["packets_sent_pro"] = len(queued)

        # mark non-selected pro-eligible packets with cap reason
        for priority, order_idx, candidate, flash_event, reasons in pro_queue:
            pkt = packet_by_id.get(candidate.packet_id)
            if not pkt:
                continue
            routing = pkt.setdefault("routing", {})
            routing.setdefault("routing_reason", [])
            if candidate.packet_id in queued_ids:
                routing["sent_to_pro"] = True
                routing["routing_reason"].extend(reasons)
            else:
                routing["routing_reason"].append("pro_k_limit")

        self.logger.log(
            "GEMINI_FLASH",
            "INFO",
            "stage_completed",
            "Flash pass completed",
            duration_ms=flash_elapsed,
            event_count=len(flash_events),
            pro_packet_count=len(queued),
        )

        pro_started = time.perf_counter()
        self.logger.log("GEMINI_PRO", "INFO", "stage_started", "Starting Gemini Pro pass", packet_count=len(queued))
        if progress_cb:
            progress_cb("GEMINI_PRO", 70, f"Preparing Pro pass for {len(queued)} packets", metrics)

        pro_events: list[FinalEvent] = []
        pro_decisions: list[dict[str, Any]] = []

        def run_pro(queue_idx: int, order_idx: int, candidate: Candidate, flash_event: FlashEvent) -> tuple[int, FinalEvent, dict[str, Any]]:
            decision = {
                "packet_id": candidate.packet_id,
                "candidate_id": candidate.candidate_id,
                "model": self.pro_model,
                "request_window_start_s": candidate.start_s,
                "request_window_end_s": candidate.end_s,
                "status": "fallback",
                "latency_ms": 0,
                "error_detail": None,
                "response": None,
            }
            if not file_ref:
                event = self._pro_fallback(order_idx, candidate, flash_event, "Fallback path used due to missing Gemini file upload.")
                decision["response"] = event.model_dump()
                return queue_idx, event, decision

            prompt = (
                "You are producing an evidence-only traffic violation record. "
                f"Use packet_id exactly as provided: {candidate.packet_id}. "
                "If plate is unreadable, return plate_text as null. "
                "If uncertain set uncertain true with reason."
            )

            fps = 4 if candidate.event_type.value == "RECKLESS_DRIVING" else 2
            payload = None
            latency_ms = 0
            for attempt in range(retry_attempts + 1):
                try:
                    payload, latency_ms = self._generate(
                        model=self.pro_model,
                        file_ref=file_ref,
                        start_s=candidate.start_s,
                        end_s=candidate.end_s,
                        fps=fps,
                        prompt=prompt,
                        schema=PRO_SCHEMA,
                        stage="GEMINI_PRO",
                        packet_id=candidate.packet_id,
                        timeout_sec=pro_timeout,
                    )
                    break
                except Exception as exc:
                    self.logger.log(
                        "GEMINI_PRO",
                        "ERROR",
                        "gemini_retry",
                        "Pro call failed",
                        packet_id=candidate.packet_id,
                        retry_count=attempt + 1,
                        error_detail=str(exc),
                    )
                    if attempt < retry_attempts:
                        time.sleep(2 ** attempt)

            if not payload:
                metrics["pro_errors"] += 1
                event = self._pro_fallback(order_idx, candidate, flash_event, "Fallback path used due to unavailable or failed Pro inference.")
                decision["status"] = "fallback"
                decision["error_detail"] = "pro_failed_or_timeout"
                decision["response"] = event.model_dump()
                return queue_idx, event, decision

            returned_packet = payload.get("packet_id")
            if returned_packet != candidate.packet_id:
                metrics["pro_errors"] += 1
                event = self._pro_fallback(order_idx, candidate, flash_event, "Fallback path used due to schema mismatch.")
                decision["status"] = "fallback"
                decision["error_detail"] = "SCHEMA_PACKET_MISMATCH"
                decision["response"] = event.model_dump()
                return queue_idx, event, decision

            try:
                event = FinalEvent(
                    event_id=payload["event_id"],
                    packet_id=candidate.packet_id,
                    source_stage="PRO_FINAL",
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
                    evidence_frames=[],
                    report_images=[],
                    evidence_clip_path=None,
                )
                decision["status"] = "ok"
                decision["latency_ms"] = latency_ms
                decision["response"] = event.model_dump()
                return queue_idx, event, decision
            except Exception:
                metrics["pro_errors"] += 1
                event = self._pro_fallback(order_idx, candidate, flash_event, "Fallback path used due to Pro schema validation failure.")
                decision["status"] = "fallback"
                decision["error_detail"] = "pro_schema_validation_failed"
                decision["response"] = event.model_dump()
                return queue_idx, event, decision

        if queued:
            with ThreadPoolExecutor(max_workers=max(1, pro_concurrency)) as executor:
                futures = {}
                for queue_idx, (_priority, order_idx, candidate, flash_event, reasons) in enumerate(queued):
                    self.logger.log(
                        "GEMINI_PRO",
                        "INFO",
                        "packet_started",
                        "Running Pro packet",
                        packet_id=candidate.packet_id,
                        packet_index=queue_idx + 1,
                        packet_total=len(queued),
                    )
                    fut = executor.submit(run_pro, queue_idx, order_idx, candidate, flash_event)
                    futures[fut] = candidate.packet_id

                total = max(1, len(futures))
                ordered: list[tuple[int, FinalEvent, dict[str, Any]]] = []
                for done_idx, future in enumerate(as_completed(futures), start=1):
                    queue_idx, event, decision = future.result()
                    ordered.append((queue_idx, event, decision))
                    pro_decisions.append(decision)
                    metrics["pro_done"] = done_idx
                    self.logger.log(
                        "GEMINI_PRO",
                        "INFO",
                        "packet_completed",
                        "Pro packet complete",
                        packet_id=event.packet_id,
                        event_id=event.event_id,
                        status=decision["status"],
                    )
                    if progress_cb:
                        pct = 70 + int((done_idx / total) * 9)
                        progress_cb("GEMINI_PRO", pct, f"Pro analyzed {done_idx}/{len(queued)} packets", metrics)

                ordered.sort(key=lambda x: x[0])
                pro_events = [row[1] for row in ordered]

        # update packet routing and write packet artifact back with traceability fields
        flash_by_packet = {f.packet_id: f for f in flash_events}
        pro_by_packet = {p.packet_id: p for p in pro_events}
        finalized = 0
        dropped = 0
        for cand in raw_candidates:
            pkt = packet_by_id.get(cand.packet_id)
            if not pkt:
                continue
            routing = pkt.setdefault("routing", {})
            routing.setdefault("routing_reason", [])
            routing["sent_to_flash"] = cand.packet_id in selected_packet_ids
            routing["sent_to_pro"] = cand.packet_id in queued_ids
            if cand.packet_id in pro_by_packet:
                finalized += 1
            elif cand.packet_id in flash_by_packet and flash_by_packet[cand.packet_id].is_relevant:
                finalized += 1
            else:
                dropped += 1
                if cand.packet_id in flash_by_packet and not flash_by_packet[cand.packet_id].is_relevant:
                    routing["routing_reason"].append("flash_not_relevant")

        metrics["packets_finalized"] = finalized
        metrics["packets_dropped"] = dropped

        write_json(run_dir / "packets.json", {"run_id": packet_payload.get("run_id"), "packets": list(packet_by_id.values())})
        write_json(run_dir / "flash_events.json", {"events": [e.model_dump() for e in flash_events]})
        write_json(run_dir / "pro_events.json", {"events": [e.model_dump() for e in pro_events]})
        write_json(run_dir / "flash_decisions.json", {"decisions": flash_decisions})
        write_json(run_dir / "pro_decisions.json", {"decisions": pro_decisions})

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
