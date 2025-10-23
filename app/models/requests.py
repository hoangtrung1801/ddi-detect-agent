"""Request models for API endpoints."""

from typing import Optional
from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    """Request model for simple query."""

    question: str = Field(
        ...,
        description="Natural language question about drug interactions",
        min_length=1,
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"question": "What are the interactions between Warfarin and Aspirin?"}
            ]
        }
    }


class ChatRequest(BaseModel):
    """Request model for chat with session."""

    question: str = Field(
        ...,
        description="Natural language question about drug interactions",
        min_length=1,
    )
    session_id: Optional[str] = Field(
        None, description="Session ID for conversation continuity"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "question": "Show me all interactions for Metformin",
                    "session_id": "optional-session-id",
                }
            ]
        }
    }


class DrugNamesFromImageRequest(BaseModel):
    """Request model for extracting drug names from image."""

    image_url: str = Field(
        ...,
        description="URL or base64-encoded image of the drug packaging/label",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"image_url": "https://example.com/drug-package.jpg"},
                {"image_url": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."},
            ]
        }
    }
