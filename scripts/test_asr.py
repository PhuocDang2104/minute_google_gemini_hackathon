import argparse
import json
from pathlib import Path

import httpx


def main() -> None:
    parser = argparse.ArgumentParser(description="Test ASR /transcribe endpoint")
    parser.add_argument("audio_path", help="Path to audio/video file")
    parser.add_argument("--url", default="http://localhost:9000", help="ASR service base URL")
    args = parser.parse_args()

    path = Path(args.audio_path)
    if not path.exists():
        raise SystemExit(f"File not found: {path}")

    url = args.url.rstrip("/") + "/transcribe"
    with path.open("rb") as f:
        files = {"file": (path.name, f, "application/octet-stream")}
        resp = httpx.post(url, files=files, timeout=900.0)

    if resp.headers.get("content-type", "").startswith("application/json"):
        print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
    else:
        print(resp.text)


if __name__ == "__main__":
    main()
