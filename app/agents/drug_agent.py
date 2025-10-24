"""
Drug Interaction Agent using LangGraph.

Modern implementation using LangGraph for better control flow and state management.
Includes drug name mapping capabilities for better drug name recognition.
"""

import os
import logging
from typing import Optional, Dict, List, Tuple
from drug_interaction_graph import DrugInteractionGraph
from .graph import DrugInteractionGraph as DrugAgentGraph

# Set up logging
logger = logging.getLogger(__name__)


class DrugInteractionAgent:
    """
    LangGraph-based conversational agent for drug interaction queries.

    Uses LangGraph for explicit workflow control and better state management.
    Includes drug name mapping capabilities for better drug name recognition.
    """

    def __init__(
        self,
        graph: DrugInteractionGraph,
        openai_api_key: Optional[str] = None,
        model_name: str = "gpt-4o-mini",
        temperature: float = 0.0,
        verbose: bool = False,
        thread_id: str = "default",
        enable_drug_mapping: bool = True,
        drug_mapping_threshold: float = 0.7,
    ):
        """
        Initialize the drug interaction agent.

        Args:
            graph: DrugInteractionGraph instance with loaded data
            openai_api_key: OpenAI API key (defaults to env var OPENAI_API_KEY)
            model_name: OpenAI model to use
            temperature: Model temperature (0.0 for deterministic)
            verbose: Whether to print agent reasoning steps
            thread_id: Thread ID for conversation memory
            enable_drug_mapping: Whether to enable drug name mapping
            drug_mapping_threshold: Similarity threshold for drug name mapping
        """
        self.graph = graph
        self.verbose = verbose
        self.thread_id = thread_id
        self.enable_drug_mapping = enable_drug_mapping
        self.drug_mapping_threshold = drug_mapping_threshold

        # Initialize drug mapper if enabled
        self.drug_mapper = None
        if enable_drug_mapping:
            try:
                from ..core.drug_mapper import get_drug_mapper

                self.drug_mapper = get_drug_mapper()
                if self.drug_mapper:
                    logger.info("Drug mapping enabled and loaded successfully")
                else:
                    logger.warning(
                        "Drug mapping enabled but failed to load. Continuing without mapping."
                    )
                    self.enable_drug_mapping = False
            except ImportError as e:
                logger.warning(
                    f"Drug mapping not available: {e}. Continuing without mapping."
                )
                self.enable_drug_mapping = False

        # Validate API key
        api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError(
                "OpenAI API key not found. Set OPENAI_API_KEY environment variable "
                "or pass openai_api_key parameter."
            )

        # Set the API key in environment for LangChain
        os.environ["OPENAI_API_KEY"] = api_key

        # Initialize the LangGraph workflow
        self.agent_graph = DrugAgentGraph(
            graph=graph,
            model_name=model_name,
            # temperature=temperature,
            # verbose=verbose,
            verbose=True,
            enable_drug_mapping=enable_drug_mapping,
        )

    def query(self, question: str) -> str:
        """
        Ask a question about drug interactions.

        Args:
            question: Natural language question about drug interactions

        Returns:
            Agent's response as a string
        """
        try:
            print(f"Question: {question}")
            response = self.agent_graph.invoke(question, thread_id=self.thread_id)
            return response
        except Exception as e:
            return f"Error processing query: {str(e)}"

    def stream_query(self, question: str):
        """
        Stream the agent's response for a question.

        Args:
            question: Natural language question about drug interactions

        Yields:
            Chunks of the response
        """
        try:
            for chunk in self.agent_graph.stream(question, thread_id=self.thread_id):
                yield chunk
        except Exception as e:
            yield {"error": str(e)}

    def clear_memory(self):
        """
        Clear the conversation history.

        Note: In LangGraph, memory is managed per thread.
        To clear memory, create a new thread_id or reinitialize the agent.
        """
        # Generate a new thread ID to effectively "clear" the conversation
        import uuid

        self.thread_id = str(uuid.uuid4())

        if self.verbose:
            print(f"Memory cleared. New thread ID: {self.thread_id}")

    def get_graph_stats(self) -> Dict[str, int]:
        """Get statistics about the drug interaction graph."""
        return self.agent_graph.get_graph_stats()

    def map_drug_name(self, drug_name: str) -> Optional[str]:
        """
        Map an extracted drug name to a standardized drug name.

        Args:
            drug_name: The drug name to map

        Returns:
            Mapped drug name or None if no mapping found
        """
        if not self.enable_drug_mapping or not self.drug_mapper:
            return drug_name  # Return original if mapping not available

        try:
            mapped_name = self.drug_mapper.map_drug_name(
                drug_name, threshold=self.drug_mapping_threshold
            )

            if mapped_name and mapped_name != drug_name:
                if self.verbose:
                    logger.info(f"Mapped '{drug_name}' -> '{mapped_name}'")
                return mapped_name
            else:
                if self.verbose:
                    logger.info(f"No mapping found for '{drug_name}'")
                return drug_name

        except Exception as e:
            logger.error(f"Error mapping drug name '{drug_name}': {e}")
            return drug_name

    def map_multiple_drugs(self, drug_names: List[str]) -> Dict[str, str]:
        """
        Map multiple drug names to standardized names.

        Args:
            drug_names: List of drug names to map

        Returns:
            Dictionary mapping original names to standardized names
        """
        if not self.enable_drug_mapping or not self.drug_mapper:
            return {
                name: name for name in drug_names
            }  # Return original names if mapping not available

        try:
            mappings = self.drug_mapper.map_multiple_drugs(
                drug_names, threshold=self.drug_mapping_threshold
            )

            # Fill in any unmapped drugs with their original names
            result = {}
            for name in drug_names:
                result[name] = mappings.get(name, name)

            if self.verbose:
                mapped_count = sum(
                    1 for orig, mapped in result.items() if orig != mapped
                )
                logger.info(f"Mapped {mapped_count}/{len(drug_names)} drug names")

            return result

        except Exception as e:
            logger.error(f"Error mapping multiple drug names: {e}")
            return {name: name for name in drug_names}

    def extract_and_map_drugs(self, text: str) -> List[str]:
        """
        Extract drug names from text and map them to standardized names.

        This is a simple implementation that looks for common drug name patterns.
        For production use, you might want to use more sophisticated NLP techniques.

        Args:
            text: Text to extract drug names from

        Returns:
            List of mapped drug names
        """
        if not self.enable_drug_mapping or not self.drug_mapper:
            # Simple fallback: return the text as-is
            return [text.strip()]

        # Simple drug name extraction (this could be enhanced with NLP)
        # Look for common patterns like "Drug A and Drug B" or "Drug A with Drug B"
        import re

        # Common separators for drug combinations
        separators = r"\b(?:and|with|,|&|\+)\b"

        # Split by separators and clean up
        potential_drugs = re.split(separators, text, flags=re.IGNORECASE)
        potential_drugs = [drug.strip() for drug in potential_drugs if drug.strip()]

        if not potential_drugs:
            potential_drugs = [text.strip()]

        # Map the extracted drug names
        mapped_drugs = []
        for drug in potential_drugs:
            mapped = self.map_drug_name(drug)
            if mapped:
                mapped_drugs.append(mapped)

        return mapped_drugs

    def get_drug_suggestions(
        self, drug_name: str, top_k: int = 5
    ) -> List[Tuple[str, float]]:
        """
        Get drug name suggestions with similarity scores.

        Args:
            drug_name: The drug name to get suggestions for
            top_k: Number of suggestions to return

        Returns:
            List of tuples (drug_name, similarity_score)
        """
        if not self.enable_drug_mapping or not self.drug_mapper:
            return []

        try:
            return self.drug_mapper.get_drug_suggestions(
                drug_name, top_k=top_k, threshold=0.5
            )
        except Exception as e:
            logger.error(f"Error getting drug suggestions for '{drug_name}': {e}")
            return []

    def is_drug_available(self, drug_name: str) -> bool:
        """
        Check if a drug name is available in the database.

        Args:
            drug_name: The drug name to check

        Returns:
            True if the drug is available, False otherwise
        """
        if not self.enable_drug_mapping or not self.drug_mapper:
            return True  # Assume available if mapping not available

        try:
            return self.drug_mapper.is_drug_available(drug_name)
        except Exception as e:
            logger.error(f"Error checking drug availability for '{drug_name}': {e}")
            return True  # Assume available on error


def create_agent(
    data_filepath: str,
    openai_api_key: Optional[str] = None,
    model_name: str = "gpt-4o-mini",
    verbose: bool = False,
    enable_drug_mapping: bool = True,
    drug_mapping_threshold: float = 0.7,
) -> DrugInteractionAgent:
    """
    Convenience function to create an agent with data loaded from file.

    Args:
        data_filepath: Path to GraphML file with drug interactions
        openai_api_key: OpenAI API key (defaults to env var)
        model_name: OpenAI model to use (gpt-4o-mini, gpt-4o, o3-mini, etc.)
        verbose: Whether to print agent reasoning
        enable_drug_mapping: Whether to enable drug name mapping
        drug_mapping_threshold: Similarity threshold for drug name mapping

    Returns:
        Initialized DrugInteractionAgent
    """
    # Load the graph
    graph = DrugInteractionGraph(data_filepath)

    if verbose:
        print(f"Initializing LangGraph agent with {model_name}...")

    # Create agent
    agent = DrugInteractionAgent(
        graph=graph,
        openai_api_key=openai_api_key,
        model_name=model_name,
        verbose=verbose,
        enable_drug_mapping=enable_drug_mapping,
        drug_mapping_threshold=drug_mapping_threshold,
    )

    if verbose:
        print("Agent ready!\n")

    return agent


if __name__ == "__main__":
    # Example usage
    from dotenv import load_dotenv

    load_dotenv()

    # Create agent
    agent = create_agent(
        data_filepath="drug_interactions.graphml",
        model_name="gpt-4o-mini",
        verbose=True,
    )

    # Example queries
    queries = [
        "What happens if I take Warfarin and Aspirin together?",
        "Show me all interactions for Metformin",
        "Is it safe to combine Ibuprofen with Alcohol?",
    ]

    # Test drug mapping functionality
    print("\n" + "=" * 70)
    print("TESTING DRUG MAPPING FUNCTIONALITY")
    print("=" * 70)

    test_drugs = ["tylenol", "advil", "aspirin", "warfarin"]
    print("Testing drug name mapping:")
    for drug in test_drugs:
        mapped = agent.map_drug_name(drug)
        print(f"  '{drug}' -> '{mapped}'")

    print("\nTesting drug suggestions:")
    suggestions = agent.get_drug_suggestions("tylenol", top_k=3)
    for name, score in suggestions:
        print(f"  {name} (similarity: {score:.3f})")

    print("\n" + "=" * 70)
    print("AGENT QUERIES")
    print("=" * 70)

    for query in queries:
        print(f"\n{'='*70}")
        print(f"Q: {query}")
        print(f"{'='*70}")
        response = agent.query(query)
        print(f"A: {response}\n")
