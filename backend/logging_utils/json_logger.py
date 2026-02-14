from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class RunLogger:
    def __init__(self, run_id: str, log_file: Path) -> None:
        self.run_id = run_id
        self.log_file = log_file
        self.log_file.parent.mkdir(parents=True, exist_ok=True)

    def log(self, stage: str, level: str, event: str, message: str, **kwargs: Any) -> None:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "run_id": self.run_id,
            "stage": stage,
            "level": level,
            "event": event,
            "message": message,
        }
        payload.update(kwargs)
        with self.log_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload) + "\n")


def tail_logs(log_file: Path, lines: int = 50) -> list[dict[str, Any]]:
    if not log_file.exists():
        return []
    content = log_file.read_text(encoding="utf-8").splitlines()
    out: list[dict[str, Any]] = []
    for line in content[-lines:]:
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out
