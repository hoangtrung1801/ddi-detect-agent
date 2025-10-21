"""
Drug Interaction Agent using LangGraph.

Modern implementation using LangGraph for better control flow and state management.
"""

import os
from typing import Optional, Dict
from drug_interaction_graph import DrugInteractionGraph
from .graph import DrugInteractionGraph as DrugAgentGraph


class DrugInteractionAgent:
    """
    LangGraph-based conversational agent for drug interaction queries.

    Uses LangGraph for explicit workflow control and better state management.
    """

    def __init__(
        self,
        graph: DrugInteractionGraph,
        openai_api_key: Optional[str] = None,
        model_name: str = "gpt-4o-mini",
        temperature: float = 0.0,
        verbose: bool = False,
        thread_id: str = "default",
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
        """
        self.graph = graph
        self.verbose = verbose
        self.thread_id = thread_id

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
            verbose=verbose,
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


def create_agent(
    data_filepath: str,
    openai_api_key: Optional[str] = None,
    model_name: str = "gpt-4o-mini",
    verbose: bool = False,
) -> DrugInteractionAgent:
    """
    Convenience function to create an agent with data loaded from file.

    Args:
        data_filepath: Path to GraphML file with drug interactions
        openai_api_key: OpenAI API key (defaults to env var)
        model_name: OpenAI model to use (gpt-4o-mini, gpt-4o, o3-mini, etc.)
        verbose: Whether to print agent reasoning

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

    for query in queries:
        print(f"\n{'='*70}")
        print(f"Q: {query}")
        print(f"{'='*70}")
        response = agent.query(query)
        print(f"A: {response}\n")
