"""Configuration settings for the workout ingestor API."""
import os


class Settings:
    """Application settings."""
    USE_LLM_NORMALIZER: bool = False
    
    def __init__(self):
        # Load from environment variable if set
        self.USE_LLM_NORMALIZER = os.getenv("USE_LLM_NORMALIZER", "false").lower() == "true"


settings = Settings()

