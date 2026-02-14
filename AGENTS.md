# AGENTS.md

This file defines repository-level operating rules for Codex and contributors.

## Non-negotiable rules
1. Keep docs in sync with code changes:
- If architecture, API contracts, stage flow, or folder layout changes, update `docs/ARCHITECTURE.md` in the same change.
- If run steps, dependencies, or commands change, update `README.md` in the same change.

2. Never commit secrets or machine-local sensitive files:
- Never commit `.env`, `.env.*`, API keys, local credential files, or generated run artifacts in `data/runs`.
- Keep `.gitignore` updated whenever new sensitive/generated paths are introduced.

3. Preserve pipeline observability:
- Any new pipeline stage must emit `stage_started`, `stage_completed`, and `stage_failed` logs.
- Log entries must remain JSONL-compatible and include `run_id`, `stage`, `event`, `message`.

4. Keep interfaces stable:
- Do not change event enums, API route shapes, or JSON output contracts without documenting the migration in `docs/ARCHITECTURE.md`.

5. Fail explicitly:
- Any stage failure must set run status to `FAILED` with `failed_stage` and `error_message`.
- Avoid silent fallbacks without a log entry explaining fallback reason.

## Change checklist (must run before commit)
1. `README.md` still accurate for full flow.
2. `docs/ARCHITECTURE.md` updated for any architecture or API changes.
3. `.gitignore` covers new secrets/artifacts.
4. Backend imports compile (`python -m compileall backend` with local pycache prefix if needed).
