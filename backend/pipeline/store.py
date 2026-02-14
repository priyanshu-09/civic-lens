from __future__ import annotations

import json
from pathlib import Path
from threading import Lock

from backend.models.types import RunRecord, RunState, RunStatus, Stage


class RunStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        self._runs: dict[str, RunRecord] = {}

    def register(self, run: RunRecord) -> None:
        with self._lock:
            self._runs[run.run_id] = run
            self._persist(run)

    def get(self, run_id: str) -> RunRecord:
        with self._lock:
            return self._runs[run_id]

    def all(self) -> list[RunRecord]:
        with self._lock:
            return list(self._runs.values())

    def update_status(self, run_id: str, status: RunStatus) -> None:
        with self._lock:
            record = self._runs[run_id]
            self._runs[run_id] = record.model_copy(update={"status": status})
            self._persist(self._runs[run_id])

    def mark_failed(self, run_id: str, stage: Stage, message: str) -> None:
        record = self.get(run_id)
        status = record.status.model_copy(
            update={
                "state": RunState.FAILED,
                "failed_stage": stage,
                "error_message": message,
                "stage": stage,
            }
        )
        self.update_status(run_id, status)

    def _persist(self, run: RunRecord) -> None:
        run_dir = self.root / run.run_id
        run_dir.mkdir(parents=True, exist_ok=True)
        status_path = run_dir / "status.json"
        status_path.write_text(run.model_dump_json(indent=2), encoding="utf-8")
