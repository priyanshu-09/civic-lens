# Civic Lens (Hackathon PoC)

Civic Lens is a local-first PoC for detecting traffic violations in dashcam videos and generating a reviewable case pack.

## What it does
- Upload a video from UI
- Run local proposal engine to find candidate violation windows
- Verify and enrich candidates using Gemini (Flash -> Pro) when API key is available
- Review events manually (accept/reject, notes, include plate)
- Export a case pack ZIP with logs, JSON artifacts, and report

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
4. Review events and save decisions
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
