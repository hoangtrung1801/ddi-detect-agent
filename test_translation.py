#!/usr/bin/env python3
"""
Test script for the Vietnamese translation functionality in the drug interaction graph.
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.agents.graph import DrugInteractionGraph
from drug_interaction_graph import DrugInteractionGraph as DrugGraph


def test_translation():
    """Test the translation functionality."""
    print("Loading drug interaction graph...")

    # Load the drug interaction graph
    drug_graph = DrugGraph()
    drug_graph.load_data()

    # Create the LangGraph workflow
    graph = DrugInteractionGraph(
        graph=drug_graph,
        model_name="gpt-4o-mini",
        verbose=True,
        enable_drug_mapping=True,
    )

    print("Testing Vietnamese translation...")

    # Test query
    test_query = "What are the interactions between aspirin and warfarin?"

    print(f"Query: {test_query}")
    print("\n" + "=" * 50)

    # Get both English and Vietnamese responses
    result = graph.invoke_with_translation(test_query)

    print("ENGLISH RESPONSE:")
    print("-" * 30)
    print(result["english"])

    print("\nVIETNAMESE RESPONSE:")
    print("-" * 30)
    print(result["vietnamese"])

    print("\n" + "=" * 50)
    print("Translation test completed!")


if __name__ == "__main__":
    test_translation()
