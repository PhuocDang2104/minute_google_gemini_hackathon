# MINUTE — Devpost Submission Pack (Gemini 3 Hackathon)

Use this as copy/paste for Devpost fields to satisfy **Submission Requirements** (English, public link, Gemini integration, testing).

---

## 1) One-liner
**MINUTE is a multimodal meeting companion that turns what’s said and shown into evidence-backed minutes — built with the Gemini 3 API.**

---

## 2) ~200-word project description (English)
MINUTE helps teams stop losing decisions after meetings. During a live call, MINUTE captures shared-tab audio, streams a real-time transcript, and publishes short recaps plus structured insights (actions, decisions, risks). After the session, users upload a recording; MINUTE extracts key visual moments (slide titles, charts, on-screen text via OCR/captioning) and links them to timestamps alongside the transcript.  
  
Powered by the **Gemini 3 API**, MINUTE generates minutes-grade outputs (executive summary, decisions, risks, and owner-ready action items with deadlines) and enables grounded Q&A over the session using tiered retrieval (session memory + uploaded documents). The system follows a “no-source-no-answer” mindset: if evidence is missing, it asks for clarification instead of guessing.  
  
We built an end-to-end web demo (React + FastAPI + Postgres/pgvector) designed for judging: a public link, reproducible steps, and a short video showing the app working exactly as submitted.

---

## 3) Gemini 3 integration (required field)
- **Gemini 3 Text**: generates in-session recaps, post-session summaries/minutes, and grounded Q&A responses.
- **Gemini 3 Multimodal (Vision)**: used in the recording pipeline to interpret visual context (keyframes + on-screen text) so answers can be grounded to “what was shown”, not just what was spoken.
- **Why it’s central**: MINUTE’s core value is evidence-backed outputs; Gemini 3 is the reasoning + generation engine for recap, minutes, and Q&A.

---

## 4) Public demo link (required)
- Demo URL: `<YOUR_PUBLIC_DEMO_URL>`
- Code repo URL: `<YOUR_PUBLIC_GITHUB_REPO_URL>`

---

## 5) Testing instructions (judges)
Goal: experience the same flow shown in the video in < 5 minutes.

1) Open the demo URL (no paywall).  
2) Create/open the demo meeting: **“Q1 Launch Sync (Demo)”**.  
3) **Live mode:** open Dock → select a browser tab and enable “share tab audio” → observe **Live Transcript** and **Recap & Insights**.  
4) **Post mode:** upload the provided short demo recording (or your own) → wait for processing → click **Generate minutes**.  
5) Ask the AI (sample prompts):  
   - “What did we decide, and why? Provide evidence.”  
   - “List action items with owner and deadline. No guessing.”  
   - “What KPI number was on the slide? Prefer the slide if there is a conflict.”  

If anything fails, judges can still evaluate via the video + screenshots in the submission.

---

## 6) Third‑party / licensing disclosure (keep short, only what you used)
- Google Gemini 3 API (core LLM + multimodal reasoning).
- Open-source libraries/frameworks (FastAPI, React, etc.).
- If you used any additional APIs/services (embeddings, storage, ASR, etc.), list them here and confirm you’re authorized.

---

## 7) Video compliance checklist (quick)
- ✅ ≤ 3 minutes; English voiceover or English subtitles
- ✅ Shows the product functioning (not slides-only)
- ✅ No secrets/PII shown (mask tokens/keys, use synthetic data)
- ✅ Avoid third‑party logos/brands in the UI/video
- ✅ Upload publicly to YouTube/Vimeo and paste the link in Devpost

---

## 8) New project requirement (important)
The hackathon requires **new projects created during the contest period**. If you started from an older codebase, consider moving the hackathon work into a **fresh public repository** and ensure the submission materials accurately reflect what was built for this contest.
