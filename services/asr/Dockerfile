FROM debian:bookworm AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        build-essential \
        cmake \
        git \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/whisper.cpp
RUN git clone --depth 1 https://github.com/ggml-org/whisper.cpp .
RUN cmake -B build -S .
RUN cmake --build build --target whisper-cli -j

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        ca-certificates \
        curl \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/whisper.cpp/build/bin/whisper-cli /usr/local/bin/whisper-cli
COPY --from=builder /opt/whisper.cpp/build/src/libwhisper.so* /usr/local/lib/
COPY --from=builder /opt/whisper.cpp/build/ggml/src/libggml.so* /usr/local/lib/
COPY --from=builder /opt/whisper.cpp/build/ggml/src/libggml-base.so* /usr/local/lib/
COPY --from=builder /opt/whisper.cpp/build/ggml/src/libggml-cpu.so* /usr/local/lib/

RUN ldconfig

RUN mkdir -p /models \
    && curl -L -o /models/ggml-tiny.en-q5_1.bin \
        https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin

ENV WHISPER_MODEL=/models/ggml-tiny.en-q5_1.bin

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 9000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000"]
