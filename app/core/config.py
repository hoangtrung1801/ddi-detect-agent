"""Application configuration."""

import os
from typing import Optional
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Settings(BaseSettings):
    """Application settings."""

    # API Configuration
    API_TITLE: str = "Drug Interaction Agent API"
    API_DESCRIPTION: str = (
        "AI-powered drug interaction query API using LangChain and DrugInteractionGraph"
    )
    API_VERSION: str = "1.0.0"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_RELOAD: bool = True

    # OpenAI Configuration
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-5-mini-2025-08-07"

    # Cloudinary Configuration
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    # Data Configuration
    DATA_FILE: str = "TWOSIDES_preprocessed.csv"

    # CORS Configuration
    CORS_ORIGINS: list = ["*"]
    CORS_CREDENTIALS: bool = True
    CORS_METHODS: list = ["*"]
    CORS_HEADERS: list = ["*"]

    # Agent Configuration
    AGENT_VERBOSE: bool = False

    class Config:
        """Pydantic configuration."""

        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields from environment

    def __init__(self, **kwargs):
        """Initialize settings with environment variables."""
        super().__init__(**kwargs)

        # Override with environment variables
        self.OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", self.OPENAI_API_KEY)
        self.OPENAI_MODEL = os.getenv("OPENAI_MODEL", self.OPENAI_MODEL)
        self.CLOUDINARY_CLOUD_NAME = os.getenv(
            "CLOUDINARY_CLOUD_NAME", self.CLOUDINARY_CLOUD_NAME
        )
        self.CLOUDINARY_API_KEY = os.getenv(
            "CLOUDINARY_API_KEY", self.CLOUDINARY_API_KEY
        )
        self.CLOUDINARY_API_SECRET = os.getenv(
            "CLOUDINARY_API_SECRET", self.CLOUDINARY_API_SECRET
        )
        self.DATA_FILE = os.getenv("DATA_FILE", self.DATA_FILE)
        self.API_HOST = os.getenv("API_HOST", self.API_HOST)
        self.API_PORT = int(os.getenv("API_PORT", str(self.API_PORT)))
        self.API_RELOAD = os.getenv("API_RELOAD", "true").lower() == "true"


# Global settings instance
settings = Settings()
