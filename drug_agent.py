"""
Drug Interaction Agent using LangChain

A conversational AI agent that uses DrugInteractionGraph to answer
questions about drug-drug interactions.
"""

from mimetypes import init
import os
from typing import Optional, Dict
from langchain.agents import initialize_agent, AgentType
from langchain.memory import ConversationBufferMemory
from langchain_openai import ChatOpenAI
from langchain.tools import Tool
from drug_interaction_graph import DrugInteractionGraph


class DrugInteractionAgent:
    """
    LangChain-based conversational agent for drug interaction queries.

    Uses DrugInteractionGraph as the knowledge base and provides natural
    language interface for querying drug interactions.
    """

    def __init__(
        self,
        graph: DrugInteractionGraph,
        openai_api_key: Optional[str] = None,
        model_name: str = "gpt-3.5-turbo",
        temperature: float = 0.0,
        verbose: bool = False,
    ):
        """
        Initialize the drug interaction agent.

        Args:
            graph: DrugInteractionGraph instance with loaded data
            openai_api_key: OpenAI API key (defaults to env var OPENAI_API_KEY)
            model_name: OpenAI model to use (gpt-3.5-turbo or gpt-4)
            temperature: Model temperature (0.0 for deterministic)
            verbose: Whether to print agent reasoning steps
        """
        self.graph = graph
        self.verbose = verbose

        # Initialize LLM
        api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError(
                "OpenAI API key not found. Set OPENAI_API_KEY environment variable "
                "or pass openai_api_key parameter."
            )

        self.llm = ChatOpenAI(
            # model=model_name, temperature=temperature, openai_api_key=api_key
            model=model_name,
            reasoning_effort="low",
            # reasoning={"effort": "low"},  # "minimal", "medium", "high"
            # model_kwargs={
            #     "text": {"verbosity": "medium"}
            # },  # "low", "medium", or "high"
        )

        # Create tools
        self.tools = self._create_tools()

        # Initialize memory
        self.memory = ConversationBufferMemory(
            memory_key="chat_history", return_messages=True, output_key="output"
        )

        # Initialize agent
        self.agent = initialize_agent(
            agent=AgentType.CHAT_CONVERSATIONAL_REACT_DESCRIPTION,
            tools=self.tools,
            llm=self.llm,
            memory=self.memory,
            verbose=verbose,
            handle_parsing_errors=True,
            max_iterations=5,
            early_stopping_method="generate",
        )

    def _create_tools(self):
        """Create LangChain tools from DrugInteractionGraph methods."""

        def search_interaction(query: str) -> str:
            """
            Search for interaction between two drugs.

            Args:
                query: String containing two drug names separated by 'and', 'with', or comma.
                      Examples: "Warfarin and Aspirin", "aspirin, warfarin"

            Returns:
                Interaction information or message if not found
            """
            # Parse drug names from query
            query = query.lower()
            separators = [" and ", " with ", ",", " & "]

            drug1, drug2 = None, None
            for sep in separators:
                if sep in query:
                    parts = query.split(sep, 1)
                    if len(parts) == 2:
                        drug1 = parts[0].strip()
                        drug2 = parts[1].strip()
                        break

            if not drug1 or not drug2:
                return "Error: Please provide two drug names separated by 'and', 'with', or comma. Example: 'Warfarin and Aspirin'"

            print(f"Searching for interaction between {drug1} and {drug2}")
            # Search in graph
            result = self.graph.search_interaction(drug1, drug2)
            print(f"Result: {result}")

            if result:
                return (
                    f"Interaction between {drug1.title()} and {drug2.title()}: {result}"
                )
            else:
                return f"No known interaction found between {drug1.title()} and {drug2.title()} in the database."

        def get_all_interactions(drug_name: str) -> str:
            """
            Get all known interactions for a specific drug.

            Args:
                drug_name: Name of the drug to query

            Returns:
                List of all interactions for the drug
            """
            drug_name = drug_name.strip()
            interactions = self.graph.get_all_interactions_for_drug(drug_name)

            if not interactions:
                return f"No interactions found for {drug_name.title()} in the database. The drug may not be in our system or has no recorded interactions."

            # Format results
            result = (
                f"Found {len(interactions)} interaction(s) for {drug_name.title()}:\n\n"
            )
            for i, interaction in enumerate(interactions, 1):
                result += f"{i}. {interaction['drug']}: {interaction['condition']}\n"

            return result.strip()

        # Create LangChain tools
        tools = [
            Tool(
                name="SearchDrugInteraction",
                func=search_interaction,
                description=(
                    "Use this tool to search for interactions between TWO specific drugs. "
                    "Input should be two drug names separated by 'and', 'with', or comma. "
                    "Example inputs: 'Warfarin and Aspirin', 'aspirin, warfarin'. "
                    "Returns the interaction condition/effect if found."
                ),
            ),
            Tool(
                name="GetAllDrugInteractions",
                func=get_all_interactions,
                description=(
                    "Use this tool to get ALL interactions for a SINGLE drug. "
                    "Input should be one drug name only. "
                    "Example inputs: 'Warfarin', 'Aspirin', 'Metformin'. "
                    "Returns a list of all drugs that interact with the specified drug and their conditions."
                ),
            ),
        ]

        return tools

    def query(self, question: str) -> str:
        """
        Ask a question about drug interactions.

        Args:
            question: Natural language question about drug interactions

        Returns:
            Agent's response as a string
        """
        try:
            response = self.agent.invoke({"input": question})
            return response.get("output", "I couldn't generate a response.")
        except Exception as e:
            return f"Error processing query: {str(e)}"

    def clear_memory(self):
        """Clear the conversation history."""
        self.memory.clear()

    def get_graph_stats(self) -> Dict[str, int]:
        """Get statistics about the drug interaction graph."""
        return self.graph.get_stats()


def create_agent(
    data_filepath: str,
    openai_api_key: Optional[str] = None,
    model_name: str = "gpt-5-mini-2025-08-07",
    verbose: bool = False,
) -> DrugInteractionAgent:
    """
    Convenience function to create an agent with data loaded from file.

    Args:
        data_filepath: Path to CSV file with drug interactions
        openai_api_key: OpenAI API key (defaults to env var)
        model_name: OpenAI model to use
        verbose: Whether to print agent reasoning

    Returns:
        Initialized DrugInteractionAgent
    """
    graph = DrugInteractionGraph("drug_interactions.graphml")

    print(f"Initializing agent with {model_name}...")
    agent = DrugInteractionAgent(
        graph=graph,
        openai_api_key=openai_api_key,
        model_name=model_name,
        verbose=verbose,
    )
    print("Agent ready!\n")

    return agent


if __name__ == "__main__":
    # Example usage
    from dotenv import load_dotenv

    load_dotenv()

    # Create agent
    agent = create_agent(data_filepath="TWOSIDES_preprocessed.csv", verbose=True)

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
