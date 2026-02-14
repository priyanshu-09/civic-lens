# Runbook

## One-time setup
1. `make backend-setup`
2. Create `.env` from `.env.example` and set `GEMINI_API_KEY` if Gemini calls are needed.

## Start services
1. Terminal 1: `make backend-run`
2. Terminal 2: `make frontend-run`

## Execute a run
1. Open `http://localhost:5173`.
2. Upload a video.
3. Optionally edit ROI JSON in UI.
4. Click `Analyze`.
5. You can open `Review` during runtime to see live packet/event updates.
6. Wait for status to reach `READY_FOR_REVIEW` for final merged output.
7. Review events and save decisions.
8. Export case pack ZIP.

## Troubleshooting
1. No events detected:
- Check `Status` page logs.
- Adjust ROI polygons and retry.

2. Gemini failures:
- Ensure `GEMINI_API_KEY` is set in backend shell.
- Review `GEMINI_UPLOAD_ERROR` / retry logs.

3. Dependency missing:
- Re-run `make backend-setup` inside project root.

4. Export issues:
- Ensure `events_final.json` exists and review decisions saved.
