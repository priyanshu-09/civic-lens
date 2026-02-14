from __future__ import annotations

from datetime import datetime
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from backend.utils.io import read_json, write_json


def _build_html(events: list[dict], review_map: dict[str, dict]) -> str:
    rows = []
    for e in events:
        review = review_map.get(e["event_id"], {})
        rows.append(
            f"<tr><td>{e['event_id']}</td><td>{e['event_type']}</td><td>{e['start_time']:.2f}-{e['end_time']:.2f}</td>"
            f"<td>{e['confidence']:.2f}</td><td>{'YES' if e['uncertain'] else 'NO'}</td>"
            f"<td>{review.get('decision', 'PENDING')}</td><td>{review.get('reviewer_notes', '')}</td></tr>"
        )
    table_rows = "\n".join(rows)
    return f"""
<html><body>
<h1>Civic Lens Case Report</h1>
<p>Generated: {datetime.utcnow().isoformat()}Z</p>
<table border="1" cellspacing="0" cellpadding="6">
<tr><th>ID</th><th>Type</th><th>Window(s)</th><th>Conf</th><th>Uncertain</th><th>Decision</th><th>Notes</th></tr>
{table_rows}
</table>
</body></html>
"""


def _build_pdf(pdf_path: Path, events: list[dict], review_map: dict[str, dict]) -> None:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas

        c = canvas.Canvas(str(pdf_path), pagesize=A4)
        w, h = A4
        y = h - 40
        c.setFont("Helvetica-Bold", 14)
        c.drawString(40, y, "Civic Lens Case Report")
        y -= 24
        c.setFont("Helvetica", 10)
        c.drawString(40, y, f"Generated: {datetime.utcnow().isoformat()}Z")
        y -= 20

        for event in events:
            review = review_map.get(event["event_id"], {})
            lines = [
                f"{event['event_id']} | {event['event_type']} | {event['start_time']:.2f}-{event['end_time']:.2f}s",
                f"Conf: {event['confidence']:.2f}, Risk: {event['risk_score']:.1f}, Uncertain: {event['uncertain']}",
                f"Decision: {review.get('decision', 'PENDING')} | Notes: {review.get('reviewer_notes', '')}",
                f"Summary: {event['explanation_short']}",
                "",
            ]
            for line in lines:
                if y < 60:
                    c.showPage()
                    y = h - 40
                    c.setFont("Helvetica", 10)
                c.drawString(40, y, line[:110])
                y -= 14
        c.save()
    except Exception:
        # Keep export deterministic in environments without PDF libs.
        pdf_path.write_text(
            "PDF generation unavailable (reportlab missing). See report.html for full details.",
            encoding="utf-8",
        )


def export_case_pack(run_dir: Path) -> Path:
    export_dir = run_dir / "export"
    export_dir.mkdir(parents=True, exist_ok=True)

    events = read_json(run_dir / "events_final.json").get("events", []) if (run_dir / "events_final.json").exists() else []
    review_payload = read_json(run_dir / "review.json") if (run_dir / "review.json").exists() else {"decisions": []}
    review_map = {d["event_id"]: d for d in review_payload.get("decisions", [])}

    html = _build_html(events, review_map)
    html_path = export_dir / "report.html"
    html_path.write_text(html, encoding="utf-8")

    pdf_path = export_dir / "report.pdf"
    _build_pdf(pdf_path, events, review_map)

    summary_path = export_dir / "summary.json"
    write_json(summary_path, {"event_count": len(events), "generated_at": datetime.utcnow().isoformat() + "Z"})

    zip_path = export_dir / "case_pack.zip"
    with ZipFile(zip_path, "w", compression=ZIP_DEFLATED) as zf:
        for artifact in [
            run_dir / "events_final.json",
            run_dir / "candidates.json",
            run_dir / "flash_events.json",
            run_dir / "pro_events.json",
            run_dir / "review.json",
            run_dir / "pipeline.log.jsonl",
            html_path,
            pdf_path,
            summary_path,
        ]:
            if artifact.exists():
                zf.write(artifact, arcname=artifact.relative_to(run_dir))

        frames_dir = run_dir / "frames"
        if frames_dir.exists():
            frame_files = sorted(frames_dir.glob("*.jpg"))[:8]
            for frame in frame_files:
                zf.write(frame, arcname=frame.relative_to(run_dir))

    return zip_path
