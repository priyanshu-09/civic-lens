# Civic Lens (Hackathon PoC)

Civic Lens is a local-first PoC for detecting traffic violations in dashcam videos and generating a reviewable case pack.

## What it does
- Upload a video from UI
- Run local proposal engine to find candidate violation windows
- Verify and enrich candidates using Gemini (Flash -> Pro) when API key is available
- Route dynamically: local packets -> Flash, only uncertain Flash packets -> Pro
- Apply max caps and concurrent Gemini routing via `backend/config/perf_config.json`
- Review events manually (accept/reject, notes, include plate)
- Export a case pack ZIP with logs, JSON artifacts, report, and incident thumbnails
- Inspect full packet lineage (`local -> flash -> pro -> final`) via run trace
- See live packet/event updates in Review screen while pipeline is still running

## Violation types in this build
- `NO_HELMET`
- `RED_LIGHT_JUMP`
- `WRONG_SIDE_DRIVING`
- `RECKLESS_DRIVING`

## Repository docs
- Architecture: `docs/ARCHITECTURE.md`
- Runbook: `docs/RUNBOOK.md`
- Codex/contributor rules: `AGENTS.md`

## Prerequisites
- Python 3.9+
- Node.js 18+
- npm

## 1) Backend setup (venv)
```bash
make backend-setup
```
Notes:
- Setup auto-selects the highest installed Python from `python3.12 -> 3.11 -> 3.10 -> 3.9 -> python3`.
- If an existing `.venv` uses a different Python minor version, it is recreated automatically.
- Dependency pins are Python-version-aware (works with Python 3.9+).

## 2) Run backend
```bash
make backend-run
```

## 3) Run frontend
```bash
make frontend-run
```

## 4) Use the app
1. Open `http://localhost:5173`
2. Upload a video and start analysis
3. Monitor stage progress + logs
4. Review events and inspect incident thumbnails
5. Export case pack

## Environment variables
Backend startup auto-loads `.env` if present.

Use `.env.example` as template, then create `.env`.

Or set in shell before starting backend:
- `GEMINI_API_KEY` (optional; fallback path works without it)
- `RUNS_DIR` (default `data/runs`)
- `MAX_GEMINI_CONCURRENCY` (default `2`)
- `DEFAULT_ANALYSIS_FPS` (default `4`)
- `GEMINI_FLASH_MODEL` (default `gemini-3-flash-preview`)
- `GEMINI_PRO_MODEL` (default `gemini-3-pro-preview`)

## Security and commits
- Do not commit `.env`, `.env.*`, `.venv`, API keys, or generated run artifacts.
- `.gitignore` already excludes these paths.

## Performance tuning
- Edit `backend/config/perf_config.json` to tune:
  - max candidate caps (`gemini_flash_max_candidates`, `gemini_pro_max_candidates`)
  - local-to-Flash threshold (`flash_min_local_score`)
  - uncertainty band for Flash->Pro escalation (`pro_uncertain_conf_low`, `pro_uncertain_conf_high`)
  - concurrency (`gemini_flash_concurrency`, `gemini_pro_concurrency`)
  - timeouts/retries
  - adaptive ingest FPS and local downscale

Routing policy in this build:
1. Local engine creates packets.
2. Only packets above `flash_min_local_score` (or top one fallback) are sent to Flash.
3. Pro is called only when Flash marks a packet uncertain or confidence lies in the configured uncertain band.
4. Both Flash and Pro are prompted to extract number plate text/candidates/confidence.

## Transparency artifacts
Each run now includes:
- `packets.json` (local packet proposals with anchor frames)
- `flash_decisions.json` (what each packet got from Flash)
- `pro_decisions.json` (what escalated packets got from Pro)
- `trace.json` (packet-level lineage and drop reasons)
