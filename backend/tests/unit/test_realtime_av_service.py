import base64
import io

import pytest

import app.services.realtime_av_service as ras
from app.services.realtime_av_service import (
    AudioRecordBlob,
    RealtimeAVService,
    format_mmss_from_ms,
    parse_mmss_to_ms,
)


def _image_b64(color: tuple[int, int, int], size: tuple[int, int] = (640, 360), striped: bool = False) -> str:
    from PIL import Image
    from PIL import ImageDraw

    image = Image.new("RGB", size, color=color)
    if striped:
        draw = ImageDraw.Draw(image)
        for x in range(0, size[0], 40):
            if (x // 40) % 2 == 0:
                draw.rectangle([x, 0, x + 19, size[1]], fill=(0, 0, 0))
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def test_parse_mmss_to_ms() -> None:
    assert parse_mmss_to_ms("00:13") == 13_000
    assert parse_mmss_to_ms("01:02") == 62_000
    assert parse_mmss_to_ms("1:02:03") == 3_723_000
    assert parse_mmss_to_ms("bad") is None
    assert format_mmss_from_ms(13_000) == "00:13"


def test_normalize_asr_segments_with_offset() -> None:
    svc = RealtimeAVService()
    record = AudioRecordBlob(record_id=7, start_ts_ms=1_000_000, end_ts_ms=1_060_000, pcm_bytes=b"")
    payload = {
        "segments": [
            {"speaker": "SPEAKER_01", "offset": "00:13", "text": "hello"},
            {"speaker": "SPEAKER_02", "start": 25.0, "end": 30.5, "text": "world"},
        ]
    }

    normalized = svc._normalize_asr_segments("sess-a", record, payload)

    assert len(normalized) == 2
    assert normalized[0].start_ts_ms == 1_013_000
    assert normalized[0].offset == "00:13"
    assert normalized[1].start_ts_ms == 1_025_000
    assert normalized[1].end_ts_ms == 1_030_500


def test_normalize_asr_segments_whisper_cpp_shape() -> None:
    svc = RealtimeAVService()
    record = AudioRecordBlob(record_id=9, start_ts_ms=2_000_000, end_ts_ms=2_060_000, pcm_bytes=b"")
    payload = {
        "result": "hello world",
        "transcription": [
            {
                "timestamps": {"from": "00:00:03,500", "to": "00:00:05,000"},
                "offsets": {"from": 3500, "to": 5000},
                "text": "hello",
            },
            {
                "offsets": {"from": 7000, "to": 9000},
                "text": "world",
            },
        ],
    }

    normalized = svc._normalize_asr_segments("sess-whisper", record, payload)

    assert len(normalized) == 2
    assert normalized[0].start_ts_ms == 2_003_500
    assert normalized[0].end_ts_ms == 2_005_000
    assert normalized[1].start_ts_ms == 2_007_000
    assert normalized[1].text == "world"


def test_extract_asr_text_prefers_result_string() -> None:
    svc = RealtimeAVService()
    assert svc._extract_asr_text({"result": "  final transcript text  "}) == "final transcript text"
    assert svc._extract_asr_text({"data": {"transcript": "hello"}}) == "hello"


@pytest.mark.asyncio
async def test_video_change_confirm_on_second_candidate(monkeypatch) -> None:
    pytest.importorskip("PIL")

    class DummyDB:
        def execute(self, *args, **kwargs):
            class _R:
                def fetchall(self):
                    return []

                def fetchone(self):
                    return None

            return _R()

        def commit(self):
            pass

        def rollback(self):
            pass

        def close(self):
            pass

    monkeypatch.setattr(ras, "SessionLocal", lambda: DummyDB())
    svc = RealtimeAVService()
    session_id = "sess-video-test"
    svc.ensure_session(session_id)

    first = await svc.handle_video_frame(
        session_id,
        {"frame_id": "f1", "image_b64": _image_b64((255, 255, 255))},
    )
    assert first["initialized"] is True

    # Ensure sampling gate passes in tests.
    sess = svc.ensure_session(session_id)
    sess.video.last_sample_ts_ms = 0
    second = await svc.handle_video_frame(
        session_id,
        {"frame_id": "f2", "image_b64": _image_b64((255, 255, 255), striped=True)},
    )
    assert second["sampled"] is True

    sess.video.last_sample_ts_ms = 0
    third = await svc.handle_video_frame(
        session_id,
        {"frame_id": "f3", "image_b64": _image_b64((255, 255, 255), striped=True)},
    )
    assert third.get("confirmed") is True
    assert "uri" in third
