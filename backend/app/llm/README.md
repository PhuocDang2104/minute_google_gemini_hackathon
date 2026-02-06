# AI / LLM Layer (LangGraph Skeleton → In-Meeting Design)

This folder hosts the AI layer for MINUTE (LangGraph + LangChain stubs). The in-meeting graph follows a multi-agent LightRAG-lite design for realtime recap + Q&A.

## Layout
- `graphs/state.py`: shared `MeetingState` TypedDict with STT segment (field name `vnpt_segment`), intent, topics, ADR, RAG, tool suggestions, debug trace. Includes a safe `StateGraph` stub when `langgraph` is missing.
- `graphs/router.py`: Stage Router for `pre` / `in` / `post`, dispatching to subgraphs.
- `graphs/in_meeting_graph.py`: multi-flow in-meeting graph (Normal / Q&A / Command) with semantic router, recap, ADR extraction, RAG, tool suggestions.
- `graphs/pre_meeting_graph.py`, `graphs/post_meeting_graph.py`: simple stubs for other stages.
- `agents/*.py`: thin wrappers that set `stage` and call the router graph.
- `chains/in_meeting_chain.py`: chains for recap, ADR extraction, Q&A (Gemini-first, Groq fallback).
- `chains/rag_chain.py`: wrapper for retrieval + LLM answer (currently simple).
- `prompts/in_meeting_prompts.py`: detailed prompts for recap/ADR/Q&A.
- `tools/smartbot_intent_tool.py`: intent classifier (LLM-first, heuristic fallback).
- `tools/rag_search_tool.py`: wrapper around simple retrieval, shaped for LightRAG buckets.
- `tools/smartbot_llm_tool.py`: legacy stub for external LLM tool-calling.

## MeetingState (in-meeting fields)
Defined in `graphs/state.py` (main fields used by the in-meeting graph):
```python
class MeetingState(TypedDict, total=False):
    meeting_id: str
    stage: Literal["pre", "in", "post"]
    intent: Literal["tick", "qa", "system"]
    sla: Literal["realtime", "near_realtime", "batch"]
    sensitivity: Literal["low", "medium", "high"]

    vnpt_segment: VNPTSegment  # text, speaker, time_start/time_end, is_final, lang, confidence
    transcript_window: str     # rolling 10-30s transcript
    full_transcript: str

    semantic_intent_label: Optional[str]
    semantic_intent_slots: Dict[str, Any]

    topic_segments: List[TopicSegment]
    current_topic_id: Optional[str]

    last_user_question: Optional[str]
    last_qa_answer: Optional[str]
    citations: list
    rag_docs: list

    actions: List[ActionItem]; decisions: List[Decision]; risks: List[Risk]
    new_actions: List[ActionItem]; new_decisions: List[Decision]; new_risks: List[Risk]

    tool_suggestions: List[ToolSuggestion]
    debug_info: Dict[str, Any]
```
Use `debug_info` for latency, routing, and chain/tool traces.

## In-Meeting Graph (Normal / Q&A / Command)
Entry point: `init` → `semantic_router` (LLM intent) → branch:
- **Normal (tick)**: `update_transcript_window` → `topic_segmenter` → `live_recap` → `adr_extractor` → `END`  
  - Recap uses `chains.in_meeting_chain.summarize_transcript` (Gemini-first).
  - ADR extractor uses `chains.in_meeting_chain.extract_adr`.
- **Q&A** (intent="qa" or label="ASK_AI"): `update_transcript_window` → `qa_prepare` → `qa_rag` (LightRAG-lite via `rag_search_tool`) → `qa_answer` → `live_recap` → `adr_extractor` → `END`.
- **Command / ADR** (label in ACTION_COMMAND, SCHEDULE_COMMAND, DECISION_STATEMENT, RISK_STATEMENT):  
  `update_transcript_window` → `command_to_adr` (map slots→ADR) → `tool_suggestion` (task/schedule stubs) → `live_recap` → `adr_extractor` → `END`.

Key helpers inside the graph:
- `semantic_router`: calls `smartbot_intent_tool.predict_intent` to set `semantic_intent_label/slots` and trace in `debug_info`.
- `_trim_window`: keeps transcript window bounded for low latency.
- `_merge_list`: deduplicates ADR entries by task/title/desc.

## Prompts (in_meeting_prompts.py)
- `RECW_PROMPT`: low-latency live recap for the last 10–30s.
- `ADR_PROMPT`: structured extraction of Actions / Decisions / Risks with JSON schema.
- `QA_PROMPT`: concise Q&A using transcript + RAG snippets with citations.

## Tools & Chains
- `smartbot_intent_tool.predict_intent(text, lang)`: intent detector (ASK_AI/ACTION_COMMAND/etc.).
- `smartbot_llm_tool.call_smartbot_llm(messages, model)`: legacy stub LLM call placeholder.
- `rag_search_tool.rag_retrieve(question, meeting_id, topic_id)`: wraps `vectorstore.simple_retrieval`, returns LightRAG-like snippets with bucket metadata.
- `chains/in_meeting_chain.py`: stub implementations for recap, ADR extraction, Q&A. Swap with real SmartBot calls and parsed JSON when available.

### LightRAG-lite & session graph
- Retriever: `vectorstore/light_rag.py` seeds LPBank-ish snippets (meeting/project/global buckets) and scores them by bucket/topic/token overlap. `rag_search_tool` now calls this.
- Topic segmentation: `segment_topic` (Gemini prompt + heuristic) feeds `topic_segments` + `current_topic_id` in state.
- Persistence: `services/in_meeting_persistence.py` stores transcript chunks, topic segments, ADR, and tool suggestions (best effort) to Postgres models (`adr.py`).
- PGVector seed: `vectorstore/ingestion/lpbank_seed.py` can upsert the seeded docs to the pgvector stub.
- Audit: `AiEventLog` / `AdrHistory` models prepared for logging.

### Tick scheduler
- `InMeetingAgent` wraps a scheduler (interval ~15s or 120 tokens). `agent.run_with_scheduler` is used by the WS handler so STT partials don’t call the LLM every tick; user questions force a tick.

## FastAPI / WS wiring (current)
- REST: `POST /api/v1/agents/{stage}` → runs router with payload shaped like `MeetingState`.
- WS: `/api/v1/ws/in-meeting/{session_id}` accepts `{chunk, question?, meeting_id?, full_transcript?, speaker?, time_start?, time_end?, is_final?, lang?}` and returns the updated `MeetingState`. The handler maps `question` → `intent="qa"`, otherwise `intent="tick"`, and passes `vnpt_segment` to the graph.

## How to extend (toward production)
1) Swap stubs with production STT + LLM calls:
   - `smartbot_intent_tool` → real intent API.
   - `in_meeting_chain` → use Gemini/Groq/other LLM with prompts in `in_meeting_prompts.py`, parse JSON for ADR.
2) Implement LightRAG-lite:
   - Replace `rag_search_tool` with a retriever that scores buckets: meeting context > project/topic docs > global.
   - Add topic/session graph updates in `topic_segmenter` and persist to DB.
3) Persist + audit:
   - After graph execution, store ADR/recap/tool suggestions into Postgres tables (ActionItem/Decision/Risk/AdrHistory/AiEventLog).
   - Log latency/token usage into `debug_info` or a metrics sink.
4) Tick scheduler & throttling:
   - Wrap `InMeetingAgent` with a scheduler to trigger LLM ticks every 10–30s or N tokens, while still updating transcript on every STT partial.
5) Tool execution:
   - Implement REST/SDK calls for Planner/Jira/LOffice/Calendar and use `tool_suggestions` for UI confirmation.

## Local usage example
```python
from app.llm.graphs.router import build_router_graph
graph = build_router_graph()
state = graph.invoke({
    "meeting_id": "demo-001",
    "stage": "in",
    "intent": "qa",
    "transcript_window": "Team discussed CR-2024-015 and API throttling...",
    "last_user_question": "Deadline cho API A là khi nào?"
})
print(state["debug_info"].get("recap"))
print(state.get("last_qa_answer"))
print(state.get("actions"))
```

## Notes
- `StateGraph` stub keeps the app runnable even without LangGraph installed.
- In-meeting graph now mirrors the documented flows; replace stubs incrementally with real VNPT AI calls and DB persistence as they become available.
