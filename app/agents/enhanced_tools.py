"""
Enhanced Drug Interaction Tools with Drug Mapping for LangGraph Agent.

Extends the basic drug interaction tools with drug name mapping capabilities.
"""

from typing import List, Optional
from langchain_core.tools import tool
from drug_interaction_graph import DrugInteractionGraph

# Import drug mapping tools
try:
    from .drug_name_mapper_tool import DRUG_MAPPING_TOOLS

    DRUG_MAPPING_AVAILABLE = True
except ImportError:
    DRUG_MAPPING_AVAILABLE = False


class EnhancedDrugInteractionTools:
    """Enhanced collection of tools for querying drug interactions with mapping."""

    def __init__(self, graph: DrugInteractionGraph, enable_drug_mapping: bool = True):
        """
        Initialize enhanced tools with a drug interaction graph and optional mapping.

        Args:
            graph: DrugInteractionGraph instance with loaded data
            enable_drug_mapping: Whether to enable drug name mapping
        """
        self.graph = graph
        self.enable_drug_mapping = enable_drug_mapping and DRUG_MAPPING_AVAILABLE

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

    def _map_drug_name(self, drug_name: str) -> str:
        """
        Map a drug name to its standardized form if mapping is enabled.

        Args:
            drug_name: The drug name to map

        Returns:
            Mapped drug name or original if mapping not available
        """
        if not self.enable_drug_mapping:
            return drug_name

        try:
            from ..core.drug_mapper import map_drug_name

            mapped = map_drug_name(drug_name, threshold=0.7)
            return mapped if mapped else drug_name
        except Exception:
            return drug_name

    def create_tools(self) -> List:
        """
        Create enhanced LangChain tools for the agent.

        Returns:
            List of tool functions decorated with @tool
        """
        graph = self.graph

        @tool
        def search_drug_interaction(query: str) -> str:
            """
            Search for interaction between two drugs with automatic drug name mapping.

            Use this tool to find specific interactions between TWO drugs.
            Input should be two drug names separated by 'and', 'with', or comma.
            Drug names will be automatically mapped to standardized forms.

            Args:
                query: Two drug names. Examples: "Warfarin and Aspirin", "tylenol, advil"

            Returns:
                Interaction information or message if not found
            """
            drug1, drug2 = EnhancedDrugInteractionTools._parse_two_drugs(query)

            if not drug1 or not drug2:
                return (
                    "Error: Please provide two drug names separated by 'and', 'with', or comma. "
                    "Example: 'Warfarin and Aspirin'"
                )

            # Map drug names if mapping is enabled
            original_drug1, original_drug2 = drug1, drug2
            drug1 = self._map_drug_name(drug1)
            drug2 = self._map_drug_name(drug2)

            # Search in graph
            result = graph.search_interaction(drug1, drug2)

            # Build response with mapping information
            response_parts = []
            if drug1 != original_drug1:
                response_parts.append(f"Mapped '{original_drug1}' to '{drug1}'")
            if drug2 != original_drug2:
                response_parts.append(f"Mapped '{original_drug2}' to '{drug2}'")

            if response_parts:
                mapping_info = "Note: " + ", ".join(response_parts) + "\n\n"
            else:
                mapping_info = ""

            if result:
                return f"{mapping_info}Interaction between {drug1.title()} and {drug2.title()}: {result}"
            else:
                return (
                    f"{mapping_info}No known interaction found between {drug1.title()} and {drug2.title()} "
                    f"in the database."
                )

        @tool
        def get_all_drug_interactions(drug_name: str) -> str:
            """
            Get all known interactions for a specific drug with automatic mapping.

            Use this tool to get ALL interactions for a SINGLE drug.
            Input should be one drug name only.
            Drug name will be automatically mapped to standardized form.

            Args:
                drug_name: Name of the drug. Examples: "Warfarin", "tylenol", "advil"

            Returns:
                List of all interactions for the drug
            """
            original_drug_name = drug_name.strip()
            drug_name = self._map_drug_name(original_drug_name)

            interactions = graph.get_all_interactions_for_drug(drug_name)

            # Build response with mapping information
            mapping_info = ""
            if drug_name != original_drug_name:
                mapping_info = (
                    f"Note: Mapped '{original_drug_name}' to '{drug_name}'\n\n"
                )

            if not interactions:
                return (
                    f"{mapping_info}No interactions found for {drug_name.title()} in the database. "
                    f"The drug may not be in our system or has no recorded interactions."
                )

            # Format results
            result = f"{mapping_info}Found {len(interactions)} interaction(s) for {drug_name.title()}:\n\n"
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
            mapping_info = ""
            if self.enable_drug_mapping:
                try:
                    from ..core.drug_mapper import get_drug_mapper

                    mapper = get_drug_mapper()
                    if mapper:
                        mapping_info = f"- Mapped drugs available: {len(mapper.get_all_drug_names())}\n"
                except Exception:
                    pass

            return (
                f"Database Statistics:\n"
                f"- Total drugs: {stats['drugs']}\n"
                f"- Total interactions: {stats['interactions']}\n"
                f"{mapping_info}"
            )

        @tool
        def map_drug_name_tool(drug_name: str) -> str:
            """
            Map a drug name to its standardized form.

            Use this tool to check how a drug name would be mapped to the standardized form.
            This is useful for understanding how the system interprets drug names.

            Args:
                drug_name: The drug name to map

            Returns:
                Mapping result with confidence information
            """
            if not self.enable_drug_mapping:
                return f"Drug mapping is not enabled. Original name: '{drug_name}'"

            try:
                from ..core.drug_mapper import map_drug_name, get_drug_mapper

                mapped_name = map_drug_name(drug_name, threshold=0.7)
                mapper = get_drug_mapper()

                if mapped_name and mapped_name != drug_name:
                    # Get suggestions for context
                    suggestions = mapper.get_drug_suggestions(
                        drug_name, top_k=3, threshold=0.5
                    )
                    confidence = (
                        "high"
                        if suggestions[0][1] > 0.8
                        else "medium" if suggestions[0][1] > 0.6 else "low"
                    )

                    result = f"Mapped '{drug_name}' to '{mapped_name}' (confidence: {confidence})"
                    if len(suggestions) > 1:
                        alternatives = [
                            f"{name} ({score:.3f})" for name, score in suggestions[1:]
                        ]
                        result += f"\nAlternatives: {', '.join(alternatives)}"
                    return result
                else:
                    return f"No mapping found for '{drug_name}'. Using original name."
            except Exception as e:
                return f"Error mapping drug name '{drug_name}': {str(e)}"

        @tool
        def get_drug_suggestions_tool(drug_name: str, top_k: int = 5) -> str:
            """
            Get drug name suggestions with similarity scores.

            Use this tool to find similar drug names when you're unsure about the exact name.

            Args:
                drug_name: The drug name to get suggestions for
                top_k: Number of suggestions to return (default: 5)

            Returns:
                List of drug name suggestions with similarity scores
            """
            if not self.enable_drug_mapping:
                return f"Drug mapping is not enabled. Cannot get suggestions for '{drug_name}'"

            try:
                from ..core.drug_mapper import get_drug_mapper

                mapper = get_drug_mapper()
                suggestions = mapper.get_drug_suggestions(
                    drug_name, top_k=top_k, threshold=0.5
                )

                if suggestions:
                    result = f"Suggestions for '{drug_name}':\n"
                    for i, (name, score) in enumerate(suggestions, 1):
                        result += f"{i}. {name} (similarity: {score:.3f})\n"
                    return result.strip()
                else:
                    return f"No suggestions found for '{drug_name}'"
            except Exception as e:
                return f"Error getting suggestions for '{drug_name}': {str(e)}"

        # Create base tools
        base_tools = [
            search_drug_interaction,
            get_all_drug_interactions,
            get_drug_statistics,
        ]

        # Add mapping tools if available
        if self.enable_drug_mapping:
            base_tools.extend(
                [
                    map_drug_name_tool,
                    get_drug_suggestions_tool,
                ]
            )

        return base_tools
