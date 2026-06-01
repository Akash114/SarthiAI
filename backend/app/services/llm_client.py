"""Zhipu GLM Coding Plan via the OpenAI-compatible Chat Completions API."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.config import Settings

if TYPE_CHECKING:
    from openai import OpenAI

DEFAULT_GLM_BASE_URL = "https://api.z.ai/api/coding/paas/v4"


def glm_configured(settings: Settings) -> bool:
    key = settings.glm_api_key
    return bool(key and key.strip())


def create_glm_client(settings: Settings) -> OpenAI:
    if not glm_configured(settings):
        raise ValueError("GLM API key is not configured")
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError("openai package is required for GLM integration") from exc

    base_url = (settings.glm_base_url or DEFAULT_GLM_BASE_URL).rstrip("/")
    return OpenAI(api_key=settings.glm_api_key, base_url=base_url)
