"""Response models for API endpoints."""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class QueryResponse(BaseModel):
    """Response model for query."""

    answer: str = Field(..., description="Agent's response to the query")
    drug_links: dict = Field(..., description="Drug links from drugs.com")
    parsed_result: dict = Field(..., description="Parsed result from the query")


class ChatResponse(BaseModel):
    """Response model for chat."""

    answer: str = Field(..., description="Agent's response to the query")
    session_id: str = Field(..., description="Session ID for this conversation")
    timestamp: str = Field(..., description="ISO timestamp of the response")


class StatsResponse(BaseModel):
    """Response model for statistics."""

    total_drugs: int = Field(..., description="Total number of drugs in the database")
    total_interactions: int = Field(
        ..., description="Total number of drug interactions"
    )
    active_sessions: int = Field(..., description="Number of active chat sessions")


class HealthResponse(BaseModel):
    """Response model for health check."""

    status: str = Field(..., description="API status")
    agent_loaded: bool = Field(..., description="Whether the agent is loaded")
    timestamp: str = Field(..., description="ISO timestamp")


class ErrorResponse(BaseModel):
    """Response model for errors."""

    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")


class DrugNamesFromImageResponse(BaseModel):
    """Response model for drug name extraction from image."""

    result: list[str] = Field(..., description="List of drug names")
    timestamp: str = Field(..., description="ISO timestamp of the response")
