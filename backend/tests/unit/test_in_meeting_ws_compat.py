from app.api.v1.websocket.in_meeting_ws import (
    _build_state_event_compat_from_window,
    _build_transcript_event_compat_from_record,
)


def test_build_transcript_event_compat_from_record() -> None:
    event = {
        "event": "transcript_record_ready",
        "seq": 12,
        "payload": {
            "record_id": 7,
            "record_start_ts_ms": 100_000,
            "record_end_ts_ms": 160_000,
            "segments": [
                {
                    "seg_id": "s0",
                    "speaker": "SPEAKER_01",
                    "start_ts_ms": 100_000,
                    "end_ts_ms": 104_000,
                    "text": "hello there",
                    "confidence": 0.9,
                },
                {
                    "seg_id": "s1",
                    "speaker": "SPEAKER_02",
                    "start_ts_ms": 113_000,
                    "end_ts_ms": 118_000,
                    "text": "follow up",
                    "confidence": 0.8,
                },
            ],
        },
    }

    origin_ms, compat = _build_transcript_event_compat_from_record(
        session_id="demo-session",
        event=event,
        timeline_origin_ms=None,
    )

    assert origin_ms == 100_000
    assert len(compat) == 2
    assert compat[0]["event"] == "transcript_event"
    assert compat[0]["seq"] == 12_000
    assert compat[0]["payload"]["meeting_id"] == "demo-session"
    assert compat[0]["payload"]["time_start"] == 0.0
    assert compat[0]["payload"]["time_end"] == 4.0
    assert compat[1]["payload"]["time_start"] == 13.0


def test_build_transcript_event_compat_respects_existing_origin() -> None:
    event = {
        "event": "transcript_record_ready",
        "seq": 2,
        "payload": {
            "record_start_ts_ms": 120_000,
            "segments": [
                {
                    "speaker": "SPEAKER_01",
                    "start_ts_ms": 120_500,
                    "text": "x",
                }
            ],
        },
    }
    origin_ms, compat = _build_transcript_event_compat_from_record(
        session_id="demo-session",
        event=event,
        timeline_origin_ms=100_000,
    )

    assert origin_ms == 100_000
    assert len(compat) == 1
    assert compat[0]["payload"]["time_start"] == 20.5


def test_build_state_event_compat_from_window() -> None:
    event = {
        "event": "recap_window_ready",
        "payload": {
            "window_id": "w1",
            "revision": 3,
            "recap": [
                {"id": "r1", "text": "A happened."},
                {"id": "r2", "text": "B happened."},
            ],
            "topics": [
                {"topic_id": "T9", "title": "Roadmap"},
            ],
        },
    }

    compat = _build_state_event_compat_from_window(event)
    assert compat["event"] == "state"
    payload = compat["payload"]
    assert payload["current_topic_id"] == "T9"
    assert payload["topic"]["title"] == "Roadmap"
    assert payload["live_recap"] == "A happened. B happened."
    assert payload["debug_info"]["window_id"] == "w1"
    assert payload["debug_info"]["revision"] == 3
