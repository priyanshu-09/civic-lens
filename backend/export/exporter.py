from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional
from zipfile import ZIP_DEFLATED, ZipFile

from backend.utils.io import read_json, write_json


def _resolve_event_path(run_dir: Path, path_value: str) -> Optional[Path]:
    p = Path(path_value)
    if p.is_absolute():
        resolved = p.resolve()
        if str(resolved).startswith(str(run_dir.resolve())):
            return resolved
        return None
    resolved = (run_dir / p).resolve()
    if not str(resolved).startswith(str(run_dir.resolve())):
        return None
    return resolved


def _prepare_report_images(run_dir: Path, export_dir: Path, events: list[dict]) -> list[dict]:
    out: list[dict] = []
    evidence_root = export_dir / "evidence"
    evidence_root.mkdir(parents=True, exist_ok=True)

    for event in events:
        event_copy = dict(event)
        report_images: list[str] = []
        event_dir = evidence_root / event_copy["event_id"]
        event_dir.mkdir(parents=True, exist_ok=True)

        seen = 0
        for idx, frame_path in enumerate(event_copy.get("evidence_frames", [])[:3]):
            resolved = _resolve_event_path(run_dir, frame_path)
            if not resolved or not resolved.exists():
                continue
            ext = resolved.suffix.lower() or ".jpg"
            dst = event_dir / f"img_{idx + 1:02d}{ext}"
            shutil.copy2(resolved, dst)
            report_images.append(str(dst.relative_to(export_dir)))
            seen += 1

        event_copy["report_images"] = report_images
        out.append(event_copy)

    return out


def _build_html(events: list[dict], review_map: dict[str, dict]) -> str:
    cards: list[str] = []
    for e in events:
        review = review_map.get(e["event_id"], {})
        images = ""
        if e.get("report_images"):
            img_tags = "".join(
                [f'<img src="{img}" style="width:220px;height:auto;border:1px solid #ccc;border-radius:6px;margin-right:8px;" />' for img in e["report_images"]]
            )
            images = f"<div style='margin-top:8px'>{img_tags}</div>"

        cards.append(
            "".join(
                [
                    "<div style='border:1px solid #ddd;border-radius:8px;padding:12px;margin-bottom:12px'>",
                    f"<div><b>{e['event_id']}</b> - {e['event_type']}</div>",
                    f"<div>Window: {e['start_time']:.2f}s - {e['end_time']:.2f}s</div>",
                    f"<div>Confidence: {e['confidence']:.2f} | Uncertain: {'YES' if e['uncertain'] else 'NO'}</div>",
                    f"<div>Decision: {review.get('decision', 'PENDING')}</div>",
                    f"<div>Notes: {review.get('reviewer_notes', '')}</div>",
                    f"<div>Summary: {e.get('explanation_short', '')}</div>",
                    images,
                    "</div>",
                ]
            )
        )

    return "".join(
        [
            "<html><body style='font-family:Arial,sans-serif'>",
            "<h1>Civic Lens Case Report</h1>",
            f"<p>Generated: {datetime.utcnow().isoformat()}Z</p>",
            "<h2>Incident Events</h2>",
            "".join(cards),
            "</body></html>",
        ]
    )


def _build_pdf(pdf_path: Path, events: list[dict], review_map: dict[str, dict], export_dir: Path) -> None:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.utils import ImageReader
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
                f"Summary: {event.get('explanation_short', '')}",
            ]
            for line in lines:
                if y < 70:
                    c.showPage()
                    y = h - 40
                    c.setFont("Helvetica", 10)
                c.drawString(40, y, line[:110])
                y -= 14

            for img in event.get("report_images", [])[:2]:
                img_path = (export_dir / img).resolve()
                if not img_path.exists():
                    continue
                if y < 130:
                    c.showPage()
                    y = h - 40
                    c.setFont("Helvetica", 10)
                c.drawImage(ImageReader(str(img_path)), 40, y - 100, width=140, height=100, preserveAspectRatio=True, mask="auto")
                y -= 110

            y -= 10
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

    events_path = run_dir / "events_final.json"
    events = read_json(events_path).get("events", []) if events_path.exists() else []
    review_payload = read_json(run_dir / "review.json") if (run_dir / "review.json").exists() else {"decisions": []}
    review_map = {d["event_id"]: d for d in review_payload.get("decisions", [])}

    events_with_images = _prepare_report_images(run_dir, export_dir, events)
    write_json(events_path, {"events": events_with_images})

    html = _build_html(events_with_images, review_map)
    html_path = export_dir / "report.html"
    html_path.write_text(html, encoding="utf-8")

    pdf_path = export_dir / "report.pdf"
    _build_pdf(pdf_path, events_with_images, review_map, export_dir)

    summary_path = export_dir / "summary.json"
    write_json(
        summary_path,
        {
            "event_count": len(events_with_images),
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "events": [{"event_id": e["event_id"], "report_image_count": len(e.get("report_images", []))} for e in events_with_images],
        },
    )

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

        evidence_dir = export_dir / "evidence"
        if evidence_dir.exists():
            for img in sorted(evidence_dir.rglob("*")):
                if img.is_file():
                    zf.write(img, arcname=img.relative_to(run_dir))

    return zip_path
