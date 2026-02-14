# Civic Lens Architecture

## Purpose
Civic Lens is a local-first hackathon PoC for traffic violation detection from dashcam clips. It uses deterministic local candidate generation and Gemini verification to produce human-reviewable case packs.

## Violation Scope (V1)
- `NO_HELMET`
- `RED_LIGHT_JUMP`
- `WRONG_SIDE_DRIVING`
- `RECKLESS_DRIVING`

## System Components
1. Frontend (`frontend/`)
- React SPA with three screens:
  - Upload
  - Status + Logs
  - Review + Export
- Chakra UI v3 system theme (`frontend/src/theme.js`) for dark styling tokens.
- Shared UI components in `frontend/src/components/`:
  - `BrandMark`
  - `StatusPill`
  - `ImageLightbox`

2. Backend API (`backend/api/main.py`)
- FastAPI endpoints for run lifecycle, status, events, review, logs, and export.
- Run metadata is restored from persisted `status.json` files on startup, so previous run IDs remain queryable after backend restarts.

3. Pipeline Orchestrator (`backend/pipeline/orchestrator.py`)
- Runs stages sequentially and persists run status.
- Stage order:
  - `INGEST`
  - `LOCAL_PROPOSALS`
  - `GEMINI_FLASH`
  - `GEMINI_PRO`
  - `POSTPROCESS`
  - `READY_FOR_REVIEW`
  - `EXPORT` (on demand)

4. Ingest (`backend/pipeline/ingest.py`)
- Decodes video and samples frames at configured FPS.
- Writes `frames_manifest.json` and sampled JPG frames.

5. Local Proposal Engine (`backend/local_engine/proposal_engine.py`)
- Uses frame differencing, optical flow, background subtraction, and manual ROI config.
- Produces `candidates.json` with candidate windows and reason codes.

6. Gemini Analyzer (`backend/gemini/client.py`)
- Uploads full video once via Files API (when key available).
- Routes packets with explicit policy:
  - Local packet must clear `flash_min_local_score` (or top-1 fallback) to reach Flash.
  - Pro is called only for Flash-uncertain packets (model uncertainty flag or confidence in configured uncertain band).
  - Flash/Pro counts are dynamic and capped by `gemini_flash_max_candidates` / `gemini_pro_max_candidates`.
- Executes Flash and Pro calls concurrently with configurable worker limits.
- Falls back to deterministic placeholder outputs if API unavailable/fails.
- Writes `flash_events.json` and `pro_events.json`.
- Writes packet-linked decision artifacts:
  - `flash_decisions.json`
  - `pro_decisions.json`
- Flash and Pro both extract number plate fields (`plate_text`, `plate_candidates`, `plate_confidence`).

7. Postprocess (`backend/postprocess/merge.py`)
- Merges Flash/Pro outputs, blends local and model confidence, selects evidence frames.
- Writes `events_final.json`.

8. Export (`backend/export/exporter.py`)
- Builds HTML report and PDF/fallback text file.
- Copies event-linked evidence frames to `export/evidence/<event_id>/` and embeds thumbnails in report HTML/PDF.
- Packages artifacts into `export/case_pack.zip`.

9. Traceability (`backend/postprocess/merge.py`)
- Merges by strict `packet_id` lineage only (no fuzzy type/time matching).
- Writes:
  - `trace.json` with `local -> flash -> pro -> final/dropped` lineage per packet.

9. Logging (`backend/logging_utils/json_logger.py`)
- Per-run JSONL logs in `pipeline.log.jsonl`.
- UI reads log tail from API.

## Data and Artifact Layout
`data/runs/<run_id>/`
- `input/video.mp4`
- `config/roi_config.json`
- `frames/`
- `frames_manifest.json`
- `candidates.json`
- `flash_events.json`
- `pro_events.json`
- `events_final.json`
- `packets.json`
- `flash_decisions.json`
- `pro_decisions.json`
- `trace.json`
- `review.json`
- `pipeline.log.jsonl`
- `export/report.html`
- `export/report.pdf` (or fallback text)
- `export/evidence/<event_id>/img_*.jpg`
- `export/case_pack.zip`

## API Contracts
1. `POST /api/runs`
- multipart upload: `video`, optional `roi_config_json`
- returns `{ "run_id": "..." }`

2. `POST /api/runs/{run_id}/start`
- starts async pipeline

3. `GET /api/runs/{run_id}/status`
- returns stage/state/progress/failure metadata plus `stage_message` and live `metrics` (flash/pro counters)

4. `GET /api/runs/{run_id}/events`
- returns final merged events when ready
- while pipeline is running, returns provisional live events (`provisional: true`) built from packet/Flash/Pro artifacts

5. `POST /api/runs/{run_id}/events/{event_id}/review`
- body: `{ decision, reviewer_notes, include_plate }`

6. `GET /api/runs/{run_id}/logs?tail=N`
- returns latest structured log lines

7. `GET /api/runs/{run_id}/artifact?path=<relative_or_abs_within_run>`
- returns a run-local artifact file (used by UI to show evidence images)

8. `GET /api/runs/{run_id}/trace`
- returns lineage trace per packet for transparency/debugging
- while postprocess output is absent, returns provisional live trace from packets + Flash/Pro decisions

9. `GET /api/runs/{run_id}/export`
- returns zip case pack

## Failure and Fallback Behavior
- Missing/failed Gemini path does not crash run by default; fallback records are generated and marked uncertain.
- Any unrecoverable stage exception sets status to `FAILED` with stage and message.

## Configuration
- Env vars:
  - `GEMINI_API_KEY`
  - `RUNS_DIR`
  - `MAX_GEMINI_CONCURRENCY`
  - `DEFAULT_ANALYSIS_FPS`
  - `GEMINI_FLASH_MODEL`
  - `GEMINI_PRO_MODEL`
- Files:
  - `backend/config/default_roi_config.json`
  - `backend/config/proposal_config.json`
  - `backend/config/perf_config.json`

## Documentation Sync Rule
Any architecture/API/stage change must update this file in the same change.
