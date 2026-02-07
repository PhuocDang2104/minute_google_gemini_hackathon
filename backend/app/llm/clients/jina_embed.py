"""
Jina Inference API client for embeddings.

Env required:
- JINA_API_KEY
Optional:
- JINA_EMBED_MODEL (default: jina-embeddings-v3)
- JINA_EMBED_TASK (default: text-matching)
- JINA_EMBED_DIMENSIONS (optional int, e.g., 1024 or 512)
"""
import os
import requests
import logging
from typing import List

logger = logging.getLogger(__name__)

JINA_URL = "https://api.jina.ai/v1/embeddings"


def _get_jina_config() -> tuple[str, str, str, str | None]:
    return (
        os.getenv("JINA_API_KEY", "").strip(),
        os.getenv("JINA_EMBED_MODEL", "jina-embeddings-v3").strip(),
        os.getenv("JINA_EMBED_TASK", "text-matching").strip(),
        os.getenv("JINA_EMBED_DIMENSIONS"),
    )


def is_jina_available() -> bool:
    api_key, _, _, _ = _get_jina_config()
    return bool(api_key)


def embed_texts(texts: List[str]) -> List[List[float]]:
    jina_api_key, jina_model, jina_task, jina_dim = _get_jina_config()
    if not jina_api_key:
        raise RuntimeError("JINA_API_KEY is not set")
    if not texts:
        return []
    payload = {
        "model": jina_model,
        "task": jina_task,
        "input": texts,
    }
    if jina_dim:
        try:
            dim_val = int(jina_dim)
            if dim_val in (1024, 512):
                payload["dimensions"] = dim_val
            else:
                logger.warning("JINA_EMBED_DIMENSIONS=%s không hợp lệ, bỏ qua (chỉ hỗ trợ 512 hoặc 1024)", jina_dim)
        except ValueError:
            logger.warning("JINA_EMBED_DIMENSIONS=%s không phải số, bỏ qua", jina_dim)
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jina_api_key}",
    }
    resp = requests.post(JINA_URL, json=payload, headers=headers, timeout=60)
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        logger.error("Jina embed error %s: %s", resp.status_code, resp.text[:500])
        raise e
    data = resp.json()
    return [item["embedding"] for item in data.get("data", [])]
