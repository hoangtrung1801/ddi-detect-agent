"""Agent management and initialization."""

import os
import uuid
from typing import Dict, Optional

from app.agents import create_agent, DrugInteractionAgent
from app.agents.medical_specialist_agent import (
    MedicalSpecialistAgent,
    create_medical_specialist_agent,
)
from app.core.config import settings


class AgentManager:
    """Manages the drug interaction agent and sessions."""

    def __init__(self):
        """Initialize the agent manager."""
        self.agent: Optional[DrugInteractionAgent] = None
        self.sessions: Dict[str, DrugInteractionAgent] = {}
        self.query_answers: Dict[str, str] = {}  # Store query answers per session
        self.medical_specialist: Optional[MedicalSpecialistAgent] = None

    def initialize_agent(self) -> None:
        """Initialize the main agent."""
        # Use GraphML file instead of CSV
        graphml_file = "drug_interactions.graphml"

        if not os.path.exists(graphml_file):
            raise FileNotFoundError(f"GraphML file '{graphml_file}' not found")

        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not found in environment variables")

        print("🚀 Starting Drug Interaction Agent API (LangGraph)...")
        self.agent = create_agent(
            data_filepath=graphml_file,
            openai_api_key=settings.OPENAI_API_KEY,
            model_name=settings.OPENAI_MODEL,
            verbose=settings.AGENT_VERBOSE,
        )
        print("✅ LangGraph Agent loaded and ready!")

    def get_agent(self) -> DrugInteractionAgent:
        """Get the main agent instance."""
        if self.agent is None:
            raise RuntimeError("Agent not initialized")
        return self.agent

    def get_or_create_session(
        self, session_id: Optional[str] = None
    ) -> tuple[str, DrugInteractionAgent]:
        """
        Get an existing session or create a new one.

        Args:
            session_id: Optional session ID. If None, creates a new session.

        Returns:
            Tuple of (session_id, session_agent)
        """
        if self.agent is None:
            raise RuntimeError("Main agent not initialized")

        # Generate session ID if not provided
        if session_id is None:
            session_id = str(uuid.uuid4())

        # Create new session if it doesn't exist
        if session_id not in self.sessions:
            self.sessions[session_id] = DrugInteractionAgent(
                graph=self.agent.graph,  # Share the same graph
                openai_api_key=settings.OPENAI_API_KEY,
                model_name=settings.OPENAI_MODEL,
                verbose=settings.AGENT_VERBOSE,
                thread_id=session_id,  # Use session_id as thread_id for memory
            )

        return session_id, self.sessions[session_id]

    def clear_session(self, session_id: str) -> bool:
        """
        Clear a specific session.

        Args:
            session_id: Session ID to clear

        Returns:
            True if session was found and cleared, False otherwise
        """
        found = False
        if session_id in self.sessions:
            self.sessions[session_id].clear_memory()
            del self.sessions[session_id]
            found = True
        if session_id in self.query_answers:
            del self.query_answers[session_id]
            found = True
        return found

    def save_query_answer(self, session_id: str, answer: str) -> None:
        """
        Save a query answer for a session.

        Args:
            session_id: Session ID
            answer: The answer to save
        """
        self.query_answers[session_id] = answer

    def get_query_answer(self, session_id: str) -> Optional[str]:
        """
        Get saved query answer for a session.

        Args:
            session_id: Session ID

        Returns:
            Saved answer or None if not found
        """
        return self.query_answers.get(session_id)

    def get_active_sessions_count(self) -> int:
        """Get the count of active sessions."""
        return len(self.sessions)

    def get_medical_specialist_agent(self) -> MedicalSpecialistAgent:
        """
        Get or create the medical specialist agent.

        Returns:
            MedicalSpecialistAgent instance
        """
        if self.medical_specialist is None:
            # Use gpt-4o-search-preview for medical specialist (built-in search capabilities)
            # Can be configured via environment variable if needed
            medical_model = os.getenv(
                "MEDICAL_SPECIALIST_MODEL", "gpt-4o-search-preview"
            )
            self.medical_specialist = create_medical_specialist_agent(
                model_name=medical_model,
                temperature=0.3,  # Balanced for medical accuracy
                verbose=settings.AGENT_VERBOSE,
                openai_api_key=settings.OPENAI_API_KEY,
            )
        return self.medical_specialist

    def cleanup(self) -> None:
        """Cleanup all sessions."""
        print("👋 Shutting down...")
        self.sessions.clear()


# Global agent manager instance
agent_manager = AgentManager()
