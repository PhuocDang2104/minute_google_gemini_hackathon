from pydantic import BaseModel, Field
from typing import Optional, Literal


LlmProvider = Literal["gemini", "groq"]


class LlmBehaviorSettings(BaseModel):
    nickname: Optional[str] = None
    about: Optional[str] = None
    future_focus: Optional[str] = None
    role: Optional[str] = None
    note_style: Optional[str] = None
    tone: Optional[str] = None
    cite_evidence: Optional[bool] = None


class LlmSettings(BaseModel):
    provider: LlmProvider
    model: str
    api_key_set: bool = False
    api_key_last4: Optional[str] = None
    visual_provider: LlmProvider = "gemini"
    visual_model: str
    visual_api_key_set: bool = False
    visual_api_key_last4: Optional[str] = None
    master_prompt: Optional[str] = None
    behavior: LlmBehaviorSettings = Field(default_factory=LlmBehaviorSettings)


class LlmSettingsUpdate(BaseModel):
    provider: LlmProvider
    model: str
    api_key: Optional[str] = Field(default=None, min_length=1)
    clear_api_key: bool = False
    visual_provider: Optional[LlmProvider] = None
    visual_model: Optional[str] = None
    visual_api_key: Optional[str] = Field(default=None, min_length=1)
    clear_visual_api_key: bool = False
    master_prompt: Optional[str] = None
    clear_master_prompt: bool = False
    behavior: Optional[LlmBehaviorSettings] = None
