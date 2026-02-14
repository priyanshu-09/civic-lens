# Project plan — Dashcam Inspector (evidence-only, non-enforcement)

## Objective

Build a hackathon MVP that analyzes dashcam video + GPS to detect a small set of traffic violations, produce human-reviewable evidence packages (annotated frames/clip + machine JSON + formatted report), and demonstrate a Gemini-powered reasoning/reporting layer that reduces false positives and generates redactable, law-aware reports for manual submission. The demo must **not** perform automatic enforcement or auto-send to authorities.

---

# Scope & constraints (hackathon MVP)

* Input: recorded dashcam video (10–30s) + mock GPS/timestamp metadata.
* Violations to detect (MVP): **No Helmet (two-wheelers)**, **Red-Light Crossing**.
* Outputs: annotated video frames, 1–3 evidence frames, OCR’d plate text (if readable), structured JSON, 1-page PDF/HTML report.
* Privacy & safety: default blur faces; user opts in to include plates; manual reviewer required before any external submission.
* No live reporting, no automatic issuing of tickets during hackathon demo.

---

# High-level architecture

1. **Frame ingest & sampling** (3–5 FPS configurable)
2. **Detector stage** — lightweight object detector for vehicles/pedestrians/riders/helmets/traffic lights; specialized LP detector for plates.
3. **Tracker** — SORT / ByteTrack to assign persistent IDs across frames.
4. **Specialized classifiers / OCR** — helmet classifier on head crops; traffic-light state classifier; PaddleOCR on plate crops.
5. **Temporal rule engine** — require persistence (K frames) + GPS speed heuristics + ROI checks to form candidate violations.
6. **Evidence packer** — select best frames, redact per policy, package JSON + clips.
7. **Gemini reasoning + report generator** — multimodal input (structured detections + 1–3 frames) → returns final decision, confidence, human summary, redact instructions, suggested statute reference (retrieval via small RAG index).
8. **Human review UI** — accept/reject + edit report → export PDF.

---

# Concrete model & repo choices (latest, tested resources you can fork now)

* Base detector (fast, exportable): **YOLOv8 (nano)** — good tooling for ONNX/TFLite export and active updates. Ultralytics. ([Hugging Face][1])
* License-plate detector (fine-tuned): **YOLOv11 license-plate** checkpoints (fast LP detection). ([Hugging Face][2])
* OCR (plates & signage): **PaddleOCR (lite/mobile)** — multi-script support, mobile deploy guides. ([GitHub][3])
* Helmet detection example repos (YOLOv8) — fork and adapt for head/helmet class finetuning. ([GitHub][4])
* Red-light detection examples (ROI + light-state logic) — reuse temporal/ROI logic. ([GitHub][5])
* Research & dataset baseline: **DashCop (WACV 2025) — code + dataset + paper** — authoritative end-to-end reference for two-wheeler helmet/no-helmet + ANPR pipeline you can reuse ideas from. DashCop. ([GitHub][6])

---

# Implementation plan (deliverables, ordered, with checkpoints)

## Phase 0 — Prep (0.5 day)

* Fork these repos: DashCop, YOLOv8 example, YOLOv11-LP HF model (or download checkpoint), PaddleOCR examples, one red-light repo. ([GitHub][6])
* Gather 5–10 Indian dashcam sample clips (public/test dataset + any you have). Use DashCop dataset samples if suitable. ([CVF Open Access][7])
* Create repo skeleton: `/ingest`, `/detectors`, `/tracker`, `/rules`, `/evidence`, `/reporting`, `/demo`.

### Checkpoint A: repo forked + sample videos in `/data`.

---

## Phase 1 — Core CV pipeline (Day 1)

* Implement frame extractor + simple runner that runs YOLOv8n on sampled frames; produce per-frame JSON (label, bbox, confidence, frame_idx). Use Ultralytics API or ONNX runtime. ([Hugging Face][1])
* Add SORT tracker to emit persistent `track_id`.
* Integrate helmet detector (fine-tune head crops or run helmet class from YOLOv8 checkpoints). Validate on sample videos. ([GitHub][4])

### Checkpoint B: per-frame JSON + track IDs + helmet/no-helmet per track.

---

## Phase 2 — Plates + OCR + light state (Day 1 → Day 2 morning)

* Run LP detector (YOLOv11-LP) on vehicle boxes → crop → run PaddleOCR; apply Indian plate regex + confidence cleaning. ([Hugging Face][2])
* Implement traffic-light ROI detection + small classifier to read light state (or infer from detected light region color across frames). Reuse red-light repo logic. ([GitHub][5])

### Checkpoint C: plate text + light state available for candidate frames.

---

## Phase 3 — Temporal rule engine & candidate selection (Day 2)

* Implement rules:

  * **No Helmet**: same `track_id` labeled rider + motorcycle and helmet confidence < threshold for ≥K frames.
  * **Red Light**: vehicle centroid crosses ROI during light state == red and speed > threshold (use GPS speed or compute pixel motion).
* Require `K = 6–8 frames` at 3–5 FPS to reduce single-frame noise.
* Produce candidate JSON with evidence frames (best frame by bounding-box area / clarity) and short clip (1–2s).

### Checkpoint D: candidate JSON emitted for violations.

---

## Phase 4 — Gemini reasoning & RAG (Day 2 afternoon → Day 3)

* Build a small RAG index with local law snippets (Motor Vehicles Act helmet clause + local red-light statute text) to attach references.
* Prepare the Gemini prompt schema (structured JSON in + 1–3 evidence frames) and instruct Gemini to return strict JSON: `violation_type, confidence, start_time, end_time, evidence_index, human_summary, suggested_law_reference, redact_instructions, uncertain, reasons`. (I will provide the paste-ready prompt.)
* Use Gemini to filter out obvious false positives (e.g., parked motorcycles, blocked plates) and to generate the human-readable summary for the report. ([CVF Open Access][7])

### Checkpoint E: Gemini returns validated report JSON for each candidate.

---

## Phase 5 — Human review UI + export (Day 3)

* Small frontend (Streamlit / React minimal) that shows:

  * Original clip + annotated timeline,
  * Evidence frames + redact toggle,
  * Gemini summary + suggested law reference,
  * Accept / Reject button → generates downloadable PDF/HTML report with selected evidence.
* Emphasize manual reviewer in UI; include mandatory “confirm consent to include plate” checkbox.

### Checkpoint F: demo flow runs end-to-end locally (video → detection → Gemini → review → export).

---

# Demo script (60–90s)

1. 5s: Problem statement slide (no autoplay enforcement).
2. 10s: Play raw dashcam clip.
3. 20s: Show annotated frames + detected violation highlighted (helmet/no-helmet or red-light).
4. 15s: Show Gemini output JSON → human summary + suggested law reference.
5. 10s: Show review UI where reviewer redacts faces and confirms plate inclusion → export PDF.
6. 5s: Ethics slide: local processing, human review, redact default.

---

# Evaluation metrics & acceptance criteria (hackathon)

* **Correct detection precision** (per violation type) ≥ 0.80 on test clips you provide (aim for ≥0.85 for demo credibility).
* **False positive rate**: ≤ 10% on held-out clips used in demo.
* **End-to-end demo**: annotated evidence + Gemini JSON + accepted PDF exported within demo.
* **Privacy safeguards**: default face blur implemented and visible in UI.

---

# Risks & mitigations

* **Surveillance/legal pushback** — mitigate: clear README + ethics slide, conform to privacy default (blur faces), require human review and explicit opt-in to share plates.
* **High FP rate at night/rain** — mitigate: increase confidence thresholds; mark `uncertain:true` in reports requiring extra review.
* **Plate OCR failures on Indian plates** — mitigate: run regex cleaning and mark low-confidence reads as “unreadable” instead of false plate matches. Use fallback OpenALPR if needed. ([Hugging Face][2])

---

# Repo & artifact mapping (what to fork / copy)

* Fork/inspect: DashCop (methodology + dataset / code). ([GitHub][6])
* Fork Ultralytics YOLOv8 examples for base detection. ([Hugging Face][1])
* Use morsetechlab YOLOv11 LP model/checkpoint for license plate detection. ([Hugging Face][2])
* Use PaddleOCR for plate OCR & on-device deployment guide. ([GitHub][3])
* Reuse helmet and red-light example repos for code patterns (detection → ROI → temporal rules). ([GitHub][4])

---

# Gemini integration — prompt & JSON schema (summary)

* **Input:** structured detections JSON + GPS + timestamps + 1–3 base64 or URL evidence frames + small RAG context (law snippets).
* **Output (strict JSON):**

```json
{
 "violation_type":"No Helmet",
 "confidence":0.91,
 "start_time":"00:14.2",
 "end_time":"00:18.0",
 "evidence_frame_index":1,
 "location_human_readable":"Outer Ring Road, Bengaluru",
 "suggested_law_reference":"Motor Vehicles Act — helmet clause",
 "human_summary":"Rider on two-wheeler visible without helmet for 4s while moving. Plate KA-05**34 detected.",
 "redact_instructions":"blur face in frame_1, keep plate visible",
 "uncertain":false,
 "reasons":["helmet probability < 0.15 across 8 frames", "track_id shows consistent motion"]
}
```

* I will produce the exact paste-ready prompt and a minimal schema you can copy into the backend on request.

---

# Timeline (48–72h hackathon target)

* Hours 0–4: Prep + fork repos + sample videos.
* Hours 4–12: Core detector + tracker + per-frame JSON.
* Hours 12–24: Helmet detector integration + plate detection + OCR.
* Hours 24–36: Temporal rules + candidate packaging + evidence selection.
* Hours 36–48: Gemini integration + RAG snippets + report generation.
* Hours 48–60: Review UI + demo recording + README + ethics slide.
* Hours 60–72: Polish, fallback handling, final demo recording.

---

# Deliverables for submission

* Working repo with README and docker or one-line run instructions.
* 60–90s demo video showing the flow above.
* Short ethics & privacy policy doc in repo.
* Minimal evaluation results (precision/FP on 5–10 test clips).

---

# Next immediate step (pick one)

1. I will produce the **paste-ready Gemini prompt + JSON schema** now.
2. I will produce the **Day-1 runnable script**: run YOLOv8n on a sample video and emit per-frame JSON (detector + tracker).
3. I will produce the **Streamlit review UI skeleton** that loads JSON + frames and exports a PDF.

Choose 1, 2, or 3 and I will generate it immediately.

[1]: https://huggingface.co/Ultralytics/YOLOv8?utm_source=chatgpt.com "Ultralytics/YOLOv8"
[2]: https://huggingface.co/morsetechlab/yolov11-license-plate-detection?utm_source=chatgpt.com "morsetechlab/yolov11-license-plate-detection"
[3]: https://github.com/PaddlePaddle/PaddleOCR?utm_source=chatgpt.com "PaddlePaddle/PaddleOCR"
[4]: https://github.com/Vansh2693/Helmet_Detection_OpenCV?utm_source=chatgpt.com "Helmet 🪖 Detection using YOLOv8"
[5]: https://github.com/diogomaymone/Red_Light_Violation_Detection_System?utm_source=chatgpt.com "Red Light Violation Detection System"
[6]: https://github.com/dash-cop/DashCop?utm_source=chatgpt.com "dash-cop/DashCop"
[7]: https://openaccess.thecvf.com/content/WACV2025/papers/Rawat_DashCop_Automated_E-Ticket_Generation_for_Two-Wheeler_Traffic_Violations_using_Dashcam_WACV_2025_paper.pdf?utm_source=chatgpt.com "DashCop: Automated E-Ticket Generation for Two-Wheeler ..."
