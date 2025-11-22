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


class DrugInteractionInfo(BaseModel):
    """Model for drug interaction information."""

    drug1: str = Field(..., description="First drug name")
    drug2: str = Field(..., description="Second drug name")
    interaction: Optional[str] = Field(None, description="Interaction details")
    has_interaction: bool = Field(..., description="Whether interaction exists")
    severity: Optional[str] = Field(None, description="Severity level if available")
    checked_at: str = Field(..., description="ISO timestamp when checked")


class AddDrugResponse(BaseModel):
    """Response model for adding a drug."""

    success: bool = Field(..., description="Whether drug was added successfully")
    message: str = Field(..., description="Status message")
    drug_name: str = Field(..., description="Name of the drug added")
    user_id: str = Field(..., description="User identifier")
    checking_interactions: bool = Field(
        ..., description="Whether interaction check is running in background"
    )
    timestamp: str = Field(..., description="ISO timestamp")


class DrugWithInteractions(BaseModel):
    """Model for drug with its interactions."""

    drug_name: str = Field(..., description="Drug name")
    interactions: Optional[str] = Field(
        None, description="Joined string of all interactions (if multiple, joined)"
    )


class MedicineCabinetListResponse(BaseModel):
    """Response model for listing medicine cabinet."""

    user_id: str = Field(..., description="User identifier")
    drugs: List[DrugWithInteractions] = Field(
        ..., description="List of drugs with their interactions"
    )
    count: int = Field(..., description="Number of drugs in cabinet")
    timestamp: str = Field(..., description="ISO timestamp")


class DrugInteractionsResponse(BaseModel):
    """Response model for drug interactions check."""

    drug_name: str = Field(..., description="Drug name checked")
    user_id: str = Field(..., description="User identifier")
    interactions: List[DrugInteractionInfo] = Field(
        ..., description="List of interactions found"
    )
    total_interactions: int = Field(..., description="Total number of interactions")
    timestamp: str = Field(..., description="ISO timestamp")
