"""
Medical Specialist Agent using GPT-4o Search Preview.

This agent uses gpt-4o-search-preview model which has built-in search capabilities
to search for valid medical knowledge corresponding to questions.
"""

import os
import logging
from typing import Optional, List, Dict
from openai import OpenAI

logger = logging.getLogger(__name__)


class MedicalSpecialistAgent:
    """
    Medical specialist agent using GPT-4o Search Preview.

    Uses gpt-4o-search-preview model which has built-in search capabilities
    to search for valid medical knowledge and answer questions.
    """

    def __init__(
        self,
        model_name: str = "gpt-4o-search-preview",
        temperature: float = 0.3,
        verbose: bool = False,
        openai_api_key: Optional[str] = None,
    ):
        """
        Initialize the medical specialist agent.

        Args:
            model_name: OpenAI model to use (default: gpt-4o-search-preview)
            temperature: Model temperature (0.3 for balanced creativity/accuracy)
            verbose: Whether to print debug information
            openai_api_key: OpenAI API key (defaults to env var OPENAI_API_KEY)
        """
        self.model_name = model_name
        self.temperature = temperature
        self.verbose = verbose

        # Initialize OpenAI client
        api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError(
                "OpenAI API key not found. Set OPENAI_API_KEY environment variable "
                "or pass openai_api_key parameter."
            )

        self.openai_client = OpenAI(api_key=api_key)

        if self.verbose:
            logger.info(
                f"Initialized medical specialist agent with model: {model_name}"
            )

    def query(
        self,
        question: str,
        chat_history: Optional[List] = None,
        context: Optional[str] = None,
    ) -> str:
        """
        Answer a medical question using GPT-4o Search Preview.

        The model will automatically search for valid medical knowledge
        corresponding to the question.

        Args:
            question: The medical question to answer
            chat_history: Optional conversation history
            context: Optional additional context (e.g., from previous drug interaction query)

        Returns:
            Answer as a string
        """
        try:
            # Prepare system prompt
            system_prompt = """You are a highly experienced medical specialist with expertise in:
- Drug interactions and pharmacology
- Clinical medicine and patient care
- Medication safety and dosing
- Evidence-based medical practice

Your role is to provide accurate, helpful medical information while always emphasizing that:
- Patients should consult healthcare professionals for medical decisions
- Information provided is for educational purposes
- Individual patient factors must be considered
- Medical decisions require professional evaluation

Use your built-in search capabilities to find the most current and accurate medical information.
Search for valid medical knowledge from reliable sources to answer questions accurately.
If you cannot find relevant information, use your medical knowledge but clearly state any limitations.

Always provide clear, understandable explanations suitable for both healthcare professionals and patients."""

            # Prepare messages list for OpenAI API
            messages: List[Dict[str, str]] = [
                {"role": "system", "content": system_prompt}
            ]

            # Add chat history if available
            if chat_history:
                for msg in chat_history:
                    if isinstance(msg, dict):
                        role = msg.get("role")
                        content = msg.get("content", "")
                        if role in ["user", "assistant", "system"]:
                            messages.append({"role": role, "content": content})

            # Build the user message with context
            user_message_parts = []

            if context:
                user_message_parts.append(
                    f"""Additional Context from Previous Query:
{context}

---"""
                )

            user_message_parts.append(f"Question: {question}")

            if context:
                user_message_parts.append(
                    "\nPlease answer the question using the context above if relevant, "
                    "and search for additional medical information as needed."
                )
            else:
                user_message_parts.append(
                    "\nPlease search for valid medical knowledge and provide a comprehensive answer."
                )

            user_message = "\n".join(user_message_parts)
            messages.append({"role": "user", "content": user_message})

            # Call OpenAI API directly with web_search_options
            completion = self.openai_client.chat.completions.create(
                # model=self.model_name,
                # temperature=self.temperature,
                model="gpt-4o-search-preview",
                web_search_options={},
                messages=messages,
            )

            answer = completion.choices[0].message.content

            if self.verbose:
                logger.info(f"Medical specialist answered question: {question[:50]}...")

            return answer or "I couldn't generate a response."

        except Exception as e:
            error_msg = f"Error processing medical query: {str(e)}"
            logger.error(error_msg)
            return error_msg


def create_medical_specialist_agent(
    model_name: str = "gpt-4o-search-preview",
    temperature: float = 0.3,
    verbose: bool = False,
    openai_api_key: Optional[str] = None,
) -> MedicalSpecialistAgent:
    """
    Convenience function to create a medical specialist agent.

    Args:
        model_name: OpenAI model to use (default: gpt-4o-search-preview)
        temperature: Model temperature
        verbose: Whether to print debug information
        openai_api_key: OpenAI API key (defaults to env var OPENAI_API_KEY)

    Returns:
        Initialized MedicalSpecialistAgent
    """
    return MedicalSpecialistAgent(
        model_name=model_name,
        temperature=temperature,
        verbose=verbose,
        openai_api_key=openai_api_key,
    )
