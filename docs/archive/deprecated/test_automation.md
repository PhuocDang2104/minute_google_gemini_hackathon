# Test Automation Guide

Tiêu chí: có script tự động, ổn định, chạy lặp 3 lần. Repo đã thêm script `scripts/run_tests.sh` để chạy toàn bộ test backend (unit + integration) 3 lần liên tiếp.

## Phạm vi
- Backend unit tests: `backend/tests/unit`
- Backend integration tests (FastAPI TestClient, không cần DB ngoài): `backend/tests/integration`
- Bỏ qua các test audio/WS thủ công (`test_audio_ws.py`, `test_audio_ingest_ws.py`, `test_ingest_ws.py`) vì cần môi trường đặc thù.

## Yêu cầu môi trường
- Python 3.11+
- Cài deps: `pip install -r requirements.txt`
- Không cần Postgres/Supabase cho bộ test này; các test dùng in-memory/mock.

## Cách chạy
Từ root repo:
```bash
bash scripts/run_tests.sh
```
Script sẽ:
1) Thiết lập `PYTHONPATH` để backend import được.  
2) Chạy `pytest -q backend/tests/unit backend/tests/integration` 3 vòng liên tiếp.  
3) Dừng ngay nếu có lỗi.

## Ghi chú ổn định
- Nếu muốn chạy một vòng duy nhất: `PYTHONPATH=backend pytest -q backend/tests/unit backend/tests/integration`.
- Nếu thêm test mới cần network hoặc DB thật, cập nhật script hoặc đánh dấu skip để giữ bộ smoke này ổn định.
