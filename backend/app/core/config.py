from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, AliasChoices
from functools import lru_cache
import os
from pathlib import Path


def find_env_file():
    """Find .env.local file in project (for local development only)"""
    possible_paths = [
        Path(__file__).parent.parent.parent / '.env.local',  # backend/.env.local
        Path(__file__).parent.parent.parent.parent / 'infra' / 'env' / '.env.local',
        Path.cwd() / '.env.local',
        Path.cwd() / 'infra' / 'env' / '.env.local',
    ]
    for p in possible_paths:
        if p.exists():
            return str(p)
    return None  # No env file found, will use environment variables


class Settings(BaseSettings):
    env: str = 'development'
    api_v1_prefix: str = '/api/v1'
    project_name: str = 'MeetMate'
    
    # Database - supports both local and cloud (Supabase/Railway)
    # Production: Set DATABASE_URL environment variable
    database_url: str = 'postgresql+psycopg2://meetmate:meetmate@localhost:5433/meetmate'
    db_pool_size: int = 10          # default pool size
    db_max_overflow: int = 20       # extra connections allowed temporarily
    db_pool_timeout: int = 30       # seconds to wait before giving up
    db_pool_recycle: int = 120      # recycle to avoid stale connections
    
    # AI API Keys - Set via environment variable in production
    openai_api_key: str = ''
    gemini_api_key: str = ''  # legacy
    groq_api_key: str = ''
    jina_api_key: str = ''
    jina_embed_model: str = 'jina-embeddings-v3'
    jina_embed_task: str = 'text-matching'
    jina_embed_dimensions: int = 1024

    # VNPT SmartVoice (streaming STT) - configured via env at deploy time
    smartvoice_grpc_endpoint: str = ''  # host:port (e.g. smartvoice.example.com:443)
    smartvoice_access_token: str = ''  # Bearer token (preferred if you already have one)
    smartvoice_token_id: str = ''
    smartvoice_token_key: str = ''
    smartvoice_auth_url: str = ''  # optional: exchange token_id/token_key for access_token
    smartvoice_model: str = 'fast_streaming'

    # VNPT GoMeet (control APIs for join URL)
    gomeet_api_base_url: str = ''  # e.g. https://gomesainterk06.vnpt.vn/api/v1
    gomeet_partner_token: str = ''  # Bearer token for GoMeet StartNewMeeting
    gomeet_timeout_seconds: int = 15
    
    # AI Model settings
    # Groq chat model used by chatbot/LLM text generation.
    # Backward-compatible aliases:
    # - LLM_GROQ_CHAT_MODEL (preferred)
    # - LLM_GROQ_MODEL (older)
    # - GROQ_MODEL (legacy)
    llm_groq_chat_model: str = Field(
        default='meta-llama/llama-4-scout-17b-16e-instruct',
        validation_alias=AliasChoices('LLM_GROQ_CHAT_MODEL', 'LLM_GROQ_MODEL', 'GROQ_MODEL'),
    )
    # Optional future-proof setting if vision inference is moved to Groq.
    llm_groq_vision_model: str = Field(
        default='meta-llama/llama-4-scout-17b-16e-instruct',
        validation_alias=AliasChoices('LLM_GROQ_VISION_MODEL'),
    )
    gemini_vision_model: str = Field(
        default='gemini-1.5-flash',
        validation_alias=AliasChoices('GEMINI_VISION_MODEL'),
    )
    gemini_model: str = 'gemini-1.5-flash'
    ai_temperature: float = 0.7
    ai_max_tokens: int = 2048
    
    # Security
    secret_key: str = 'dev-secret-key-change-in-production'
    supabase_jwt_secret: str = ''  # Set to Supabase JWT secret to verify Supabase tokens
    supabase_jwt_aud: str = 'authenticated'  # Supabase default audience

    # CORS - comma separated origins or "*" for all
    cors_origins: str = '*'
    
    # Email Settings (Gmail SMTP)
    # For Gmail: use App Password, not regular password
    # Get App Password: https://myaccount.google.com/apppasswords
    smtp_host: str = 'smtp.gmail.com'
    smtp_port: int = 587
    smtp_user: str = ''  # your-email@gmail.com
    smtp_password: str = ''  # App Password (16 chars, no spaces)
    email_from_name: str = 'MeetMate AI'
    email_enabled: bool = False  # Set to True when SMTP is configured
    marketing_broadcast_token: str = ''  # Optional shared secret for bulk email triggers

    # Supabase Storage (S3-compatible)
    supabase_s3_endpoint: str = ''
    supabase_s3_region: str = ''
    supabase_s3_bucket: str = ''
    supabase_s3_access_key: str = ''
    supabase_s3_secret_key: str = ''
    
    # Video upload settings
    max_video_file_size_mb: int = 100  # Maximum video file size in MB (default 100MB for Supabase free tier)
    
    # Diarization API (Hugging Face Space)
    diarization_api_url: str = ''  # e.g. https://anhoaithai345-meetmate.hf.space/api/diarize

    # Local ASR microservice (whisper.cpp)
    asr_url: str = 'http://asr:9000'

    # Realtime AV pipeline (batch ASR + slide change detection + recap windows)
    realtime_av_record_ms: int = 30000
    realtime_av_window_ms: int = 120000
    realtime_av_window_overlap_ms: int = 15000
    realtime_av_video_sample_ms: int = 1000
    realtime_av_dhash_threshold: int = 16
    realtime_av_candidate_ticks: int = 2
    realtime_av_ssim_threshold: float = 0.90
    realtime_av_cooldown_ms: int = 2000
    realtime_av_capture_width: int = 960
    realtime_av_capture_height: int = 540
    realtime_av_detection_width: int = 320
    realtime_av_detection_height: int = 180

    model_config = SettingsConfigDict(
        env_file=find_env_file(),
        env_file_encoding='utf-8',
        extra='ignore',
        # Environment variables take priority over .env file
        env_priority='environment'
    )
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.database_url and self.database_url.startswith('postgres://'):
            self.database_url = self.database_url.replace('postgres://', 'postgresql://', 1)

    @property
    def groq_model(self) -> str:
        """
        Backward-compat accessor.
        Prefer using `llm_groq_chat_model` in new code.
        """
        return self.llm_groq_chat_model

    @property
    def llm_groq_model(self) -> str:
        """
        Backward-compat accessor for code migrated from `llm_groq_model`.
        """
        return self.llm_groq_chat_model


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
