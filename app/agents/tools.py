"""
Drug Interaction Tools for LangGraph Agent.

Defines the tools/functions that the agent can use to query drug interactions.
"""

from typing import List
from langchain_core.tools import tool
from drug_interaction_graph import DrugInteractionGraph


class DrugInteractionTools:
    """Collection of tools for querying drug interactions."""

    def __init__(self, graph: DrugInteractionGraph):
        """
        Initialize tools with a drug interaction graph.

        Args:
            graph: DrugInteractionGraph instance with loaded data
        """
        self.graph = graph

    @staticmethod
    def _parse_two_drugs(query: str) -> tuple[str | None, str | None]:
        """
        Parse two drug names from a query string.

        Args:
            query: String containing two drug names

        Returns:
            Tuple of (drug1, drug2) or (None, None) if parsing fails
        """
        query = query.lower()
        separators = [" and ", " with ", ",", " & "]

        for sep in separators:
            if sep in query:
                parts = query.split(sep, 1)
                if len(parts) == 2:
                    return parts[0].strip(), parts[1].strip()

        return None, None

    def create_tools(self) -> List:
        """
        Create LangChain tools for the agent.

        Returns:
            List of tool functions decorated with @tool
        """
        graph = self.graph

        @tool
        def search_drug_interaction(query: str) -> str:
            """
            Search for interaction between two drugs.

            Use this tool to find specific interactions between TWO drugs.
            Input should be two drug names separated by 'and', 'with', or comma.

            Args:
                query: Two drug names. Examples: "Warfarin and Aspirin", "aspirin, warfarin"

            Returns:
                Interaction information or message if not found
            """
            drug1, drug2 = DrugInteractionTools._parse_two_drugs(query)

            if not drug1 or not drug2:
                return (
                    "Error: Please provide two drug names separated by 'and', 'with', or comma. "
                    "Example: 'Warfarin and Aspirin'"
                )

            # Search in graph
            result = graph.search_interaction(drug1, drug2)
            print(
                f"Search interaction between {drug1} and {drug2} -->  result: {result}"
            )

            if result:
                return (
                    f"Interaction between {drug1.title()} and {drug2.title()}: {result}"
                )
            else:
                return (
                    f"No known interaction found between {drug1.title()} and {drug2.title()} "
                    f"in the database."
                )

        @tool
        def get_all_drug_interactions(drug_name: str) -> str:
            """
            Get all known interactions for a specific drug.

            Use this tool to get ALL interactions for a SINGLE drug.
            Input should be one drug name only.

            Args:
                drug_name: Name of the drug. Examples: "Warfarin", "Aspirin", "Metformin"

            Returns:
                List of all interactions for the drug
            """
            drug_name = drug_name.strip()
            interactions = graph.get_all_interactions_for_drug(drug_name)

            if not interactions:
                return (
                    f"No interactions found for {drug_name.title()} in the database. "
                    f"The drug may not be in our system or has no recorded interactions."
                )

            # Format results
            result = (
                f"Found {len(interactions)} interaction(s) for {drug_name.title()}:\n\n"
            )
            for i, interaction in enumerate(interactions, 1):
                result += f"{i}. {interaction['drug']}: {interaction['condition']}\n"

            return result.strip()

        @tool
        def get_drug_statistics() -> str:
            """
            Get statistics about the drug interaction database.

            Use this tool to get general information about the database,
            such as total number of drugs and interactions.

            Returns:
                Database statistics
            """
            stats = graph.get_stats()
            return (
                f"Database Statistics:\n"
                f"- Total drugs: {stats['drugs']}\n"
                f"- Total interactions: {stats['interactions']}"
            )

        return [
            search_drug_interaction,
            get_all_drug_interactions,
            get_drug_statistics,
        ]
