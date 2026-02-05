import requests

url = "http://localhost:9000/transcribe"
path = "asr_test.mp3"  # hoặc sample.wav/mp4

with open(path, "rb") as f:
    r = requests.post(url, files={"file": (path, f)})
r.raise_for_status()
print(r.json().keys())
