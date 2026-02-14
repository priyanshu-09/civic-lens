Got it — with an M1 Pro and a Gemini-focused hackathon, the best “scrappy but works” approach is a **cascaded architecture**:

* **Local, cheap “proposal + timestamping”** (so you don’t spam the API and you’re not betting everything on 1 model call),
* **Gemini 3 (Flash → Pro) as the “judge + explainer + plate reader”** on *short, clipped windows*.

This gives you a reliable demo story: *“We don’t just ask an LLM to hallucinate violations; we detect candidate moments locally, then Gemini confirms and produces a clean case file.”*

Below is the architecture I’d use, and a concrete plan.

---

## What Gemini 3 Pro can do that matters for your project

Key capabilities from the official Gemini docs:

* **Video understanding**: Gemini can “describe, segment, and extract information from videos,” answer questions, and **refer to timestamps** in the video. ([Google AI for Developers][1])
* **Large video inputs via File API**: You can upload video using the File API (up to **2GB free / 20GB paid**) and reuse it across requests. ([Google AI for Developers][1])
* **Timestamping + internal sampling**: When you upload via File API, Gemini stores video at **1 FPS** by default, adds timestamps every second, and tokenizes roughly **~300 tokens/sec at default resolution** or **~100 tokens/sec at low resolution**. This is huge for cost/latency planning. ([Google AI for Developers][1])
* **Clip only the part you need**: You can set **clipping intervals** (`videoMetadata` start/end offsets) so the model processes only a slice of the video. ([Google AI for Developers][1])
* **Increase FPS for fast events**: You can also set a custom **fps** in `videoMetadata` (useful for collisions/cut-ins where 1 FPS might miss the key moment). ([Google AI for Developers][1])
* **Control cost/quality**:

  * `thinking_level` to trade off latency/cost vs deeper reasoning ([Google AI for Developers][2])
  * `media_resolution` to trade off detail (e.g., reading plates) vs token usage ([Google Cloud Documentation][3])
* **Structured outputs (JSON Schema)**: You can force Gemini responses to adhere to a JSON Schema so your pipeline is robust. ([Google AI for Developers][4])
* **Context caching**: For longer videos or multiple queries against the same upload, caching can reduce cost/latency (implicit by default; explicit available). ([Google AI for Developers][5])
* **Model choice**:

  * `gemini-3-pro-preview` (strongest reasoning, multimodal fidelity)
  * `gemini-3-flash-preview` (faster/cheaper, still strong) ([Google AI for Developers][2])

This is exactly what you need to build a “proposal → verify → case file” system.

---

## The best scrappy architecture for your constraints

### High-level idea

1. **Local “event proposals”**: scan the video cheaply and propose *time windows* that likely contain a violation / reckless driving / hit-run pattern.
2. **Gemini “event verification + enrichment”**: run Gemini only on those windows (clipped), ask for structured JSON including timestamps, vehicle description, plate, and a risk score.
3. **Case builder**: dedupe/merge events, create a timeline UI, and export a “case pack” (clips + JSON).

### Why not “Gemini on the whole video”?

You *can*, and for short clips it’s fine. But for hackathon reliability:

* **1 FPS default sampling** can miss fast cut-ins/collisions unless you clip + raise fps. ([Google AI for Developers][1])
* A full-video pass can be slower/costlier and harder to debug.
* You want a story that demonstrates engineering, not “we pasted a video into a prompt.”

---

## Proposed pipeline (MVP that works)

### Stage A — Local “proposal engine” (runs on M1 Pro)

Goal: return a list of candidate windows like:
`[{start_s: 112.0, end_s: 126.0, reason: "possible_red_light"}, ...]`

**A1) Video ingest + sampling**

* Use ffmpeg/OpenCV to decode and sample at **3–5 FPS** for analysis (not full 30 FPS).
* Optionally create a downscaled analysis stream (e.g., 720p) for speed.

**A2) Lightweight detection + tracking (optional but recommended)**
Scrappy choice:

* Use a small YOLO model on-device (nano) on Apple MPS (PyTorch) at low FPS.
* Track IDs using ByteTrack/BoT-SORT (or even a simpler centroid tracker).

You only need coarse classes:

* car/truck/bus
* motorcycle/scooter
* person

**A3) Proposal heuristics (these are “good enough” triggers)**
You want triggers for:

* **Traffic violation candidates**

  * *Red-light jump candidate*: traffic light appears red-ish + vehicle crosses a rough “intersection line region”
  * *No helmet candidate*: motorcycle + rider visible close enough (bbox height threshold) and “helmet likely absent” (even if your helmet detector is weak, Gemini will verify)
* **Reckless driving candidates** (score-based)

  * sudden lateral movement (weaving/cut-in): high variance in x-velocity of a vehicle track
  * close approach: vehicle bbox area increasing quickly (proxy for closing distance)
  * near-collision: two tracked objects’ bboxes overlap or come extremely close
* **Hit-and-run candidates**

  * collision proxy = sudden global motion spike (camera shake) + near object surge + sudden occlusion/disappearance
  * then vehicle moves away / disappears after impact window

**Output of Stage A:** top-N windows (e.g., 5–20) ranked by “risk score.”

This stage is purely to *save Gemini calls and improve reliability*.

---

### Stage B — Gemini analysis (Flash → Pro cascade)

Goal: turn each candidate window into a clean, structured “event.”

**B0) Upload once, then clip**

* Upload the full video via **Files API** and reuse it. ([Google AI for Developers][1])
* For each candidate window, send the video as input **with `videoMetadata` clipping offsets**. ([Google AI for Developers][1])

This is the single biggest architecture win: *no re-encoding, no re-uploading per event, and you’re not paying for the whole file each time.*

**B1) First pass: Gemini 3 Flash**
Use `gemini-3-flash-preview` for fast filtering:

* Confirm whether there is *any* relevant event in that clip
* Return:

  * event type (from an enum)
  * rough confidence
  * timestamps
  * “which vehicle is the violator” (description)
  * whether plate is visible

Flash is built to be fast/cheap while staying strong. ([Google AI for Developers][2])

**B2) Second pass (only for promising clips): Gemini 3 Pro**
Use `gemini-3-pro-preview` only when:

* Flash says confidence is high, OR
* plate is visible, OR
* it’s a high-stakes “hit-and-run” candidate

Pro is best for complex multimodal reasoning. ([Google AI for Developers][2])

**Critical settings**

* For “does a violation exist?”:

  * `thinking_level: low` (cheaper/faster) ([Google AI for Developers][2])
  * `media_resolution: low/medium`
* For plate reading:

  * bump `media_resolution` (and/or provide one or two high-res frames) ([Google Cloud Documentation][3])
* For fast collisions/cut-ins:

  * set `videoMetadata.fps = 2–4` for that clipped window so 1 FPS doesn’t miss the key moment ([Google AI for Developers][1])

**B3) Force JSON**
Use **Structured Outputs (JSON Schema)** so your UI isn’t parsing free text. ([Google AI for Developers][4])

Example event types (MVP enum):

* `RED_LIGHT_JUMP`
* `NO_HELMET`
* `WRONG_WAY`
* `DANGEROUS_CUT_IN`
* `TAILGATING_CLOSE_FOLLOW`
* `HIT_AND_RUN_SUSPECTED`
* `NEAR_COLLISION`
* `RECKLESS_DRIVING_GENERAL`

**B4) Use timestamps explicitly**
Gemini supports prompts that reference timestamps (MM:SS). ([Google AI for Developers][1])
In your prompt, require:

* `start_time`, `end_time`
* `key_moments: [{t:"MM:SS", note:"..."}]`

---

### Stage C — Case builder + UI

For hackathon, keep it simple:

**Case entity**

* `case_id`
* `event_type`
* `start_time`, `end_time`
* `confidence`
* `risk_score (0–100)`
* `violator_description` (vehicle type/color + position)
* `plate_text` + `plate_confidence` + `plate_visible: true/false`
* `supporting_evidence` (clip path + 1–3 screenshots)
* `explanation` (short narrative)

**UI**

* Upload video
* “Analyze” button
* Timeline of events with thumbnails
* Click event → play clipped video + show JSON + summary

---

## How to define “bad driving score” scrappily

You want *a score* even when you don’t confidently label a legal violation.

Use a two-layer scoring strategy:

### Local risk score (cheap, continuous)

For each vehicle track / time window, compute:

* **Close approach score**: rate of bbox area growth
* **Weave score**: lateral acceleration proxy from x-center over time
* **Conflict score**: minimum distance / IoU with another object
* **Instability score**: global motion spikes (collision proxy)

This yields `risk_local ∈ [0,100]`.

### Gemini risk score (semantic)

For top risky windows, ask Gemini to output:

* `risk_gemini ∈ [0,100]`
* and a short reason, tied to timestamps

Final risk can be:

* `risk_final = 0.4 * risk_local + 0.6 * risk_gemini`

This makes your demo feel grounded (“we compute signals”) but still Gemini-powered.

---

## A concrete plan for going forward (48–72h hackathon)

### Day 0.5 — Lock scope + schema

* Pick **4–6 event types** to demo well:

  * Red light jump
  * No helmet
  * Dangerous cut-in / near collision
  * Hit-and-run suspected
  * Reckless driving score (general)
* Define your JSON Schema for “Event”.

### Day 1 — Build local proposal engine

* Video decode + sampling
* (Optional but recommended) YOLO small detector + simple tracking
* Implement windowing + risk features
* Output: top 10 candidate windows + reasons

### Day 2 — Integrate Gemini (Flash → Pro)

* Upload video via Files API
* For each candidate window:

  * Gemini Flash: classify + filter
  * Gemini Pro: enrich (plate + final narrative) only if needed
* Use **clipping intervals** (`videoMetadata.start_offset/end_offset`) ([Google AI for Developers][1])
* Use structured outputs with JSON Schema ([Google AI for Developers][4])
* Add custom fps only for the few “fast action” clips ([Google AI for Developers][1])

### Day 3 — UI + demo polish

* Streamlit or a minimal web UI
* Timeline + event viewer
* Export “case pack” folder:

  * `events.json`
  * `clips/`
  * `frames/`

Optional optimization if time:

* Use **context caching** if you’re making many queries against the same uploaded video (especially >10 min). ([Google AI for Developers][5])

---

## The prompt strategy that will make this work reliably

Use **two prompts** (Flash then Pro), both with structured output.

### Flash prompt (fast filter)

* Input: clipped window
* Output: `{is_relevant, event_type, confidence, timestamps, plate_visible, violator_desc}`

### Pro prompt (enrich + plate)

* Input: same clipped window (maybe higher media_resolution)
* Output: full Event JSON + plate candidates + “if unsure, say unsure”

Important: explicitly instruct:

* “If plate is not clearly readable, return `plate_text: null` and `plate_candidates: []`.”
  This reduces embarrassing hallucinations.

---

## One more thing: your “no cloud” constraint

Just to align words: **Gemini API calls are cloud inference**, but you’re not running *your own* cloud compute. With this architecture:

* everything heavy/continuous happens locally,
* Gemini calls are *sparse and clipped*, so it feels “offline-first” in practice.

---

## A few final clarifying questions (so I can tailor the exact MVP event set + thresholds)

1. Typical video length you’ll demo with: **30s, 2–5 min, or 10–30 min?**
2. Is audio available/usable? (Audio helps hit-and-run detection sometimes.)
3. Do you want to support **night videos**, or is the demo daytime only?

If you answer those, I can give you:

* the exact **Event JSON Schema** to use with Structured Outputs,
* a recommended set of local heuristics (with threshold starting points),
* and a “Flash→Pro routing policy” (when to escalate).

---

* [IT Pro](https://www.itpro.com/technology/artificial-intelligence/google-launches-flagship-gemini-3-model-and-google-antigravity-a-new-agentic-ai-development-platform?utm_source=chatgpt.com)
* [The Verge](https://www.theverge.com/news/822833/google-antigravity-ide-coding-agent-gemini-3-pro?utm_source=chatgpt.com)
* [Android Central](https://www.androidcentral.com/apps-software/ai/gemini-3-deep-think-is-now-available-in-the-gemini-app-but-only-for-subscribers?utm_source=chatgpt.com)
* [TechRadar](https://www.techradar.com/ai-platforms-assistants/gemini/openai-and-google-quietly-limit-free-sora-nano-banana-pro-and-gemini-3-pro-use-heres-what-it-means-for-you?utm_source=chatgpt.com)

[1]: https://ai.google.dev/gemini-api/docs/video-understanding "Video understanding  |  Gemini API  |  Google AI for Developers"
[2]: https://ai.google.dev/gemini-api/docs/gemini-3 "Gemini 3 Developer Guide  |  Gemini API  |  Google AI for Developers"
[3]: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro "Gemini 3 Pro  |  Generative AI on Vertex AI  |  Google Cloud Documentation"
[4]: https://ai.google.dev/gemini-api/docs/structured-output "Structured outputs  |  Gemini API  |  Google AI for Developers"
[5]: https://ai.google.dev/gemini-api/docs/caching "Context caching  |  Gemini API  |  Google AI for Developers"
