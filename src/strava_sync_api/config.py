"""Configuration management for Strava API service."""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings."""
    
    # Strava OAuth
    strava_client_id: str
    strava_client_secret: str
    strava_redirect_uri: str
    
    # App settings
    app_name: str = "Strava Connections Service"
    app_version: str = "1.0.0"
    frontend_url: str = "http://localhost:3000"
    
    # Security
    internal_api_key: str  # For service-to-service authentication
    encryption_key: str  # For token encryption at rest (32 bytes base64)
    
    # Supabase (to be configured later)
    supabase_url: Optional[str] = None
    supabase_key: Optional[str] = None
    
    # Strava API
    strava_api_base: str = "https://www.strava.com/api/v3"
    
    # Rate limiting
    rate_limit_per_minute: int = 60
    
    # Logging
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

