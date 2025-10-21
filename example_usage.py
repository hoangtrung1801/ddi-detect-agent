"""
Example usage of DrugInteractionGraph

Demonstrates loading data, searching for interactions, and performance benchmarking.
"""

import time
from drug_interaction_graph import DrugInteractionGraph

# data_filepath = "TWOSIDES_preprocessed.csv"
data_filepath = "db_drug_interactions.csv"


def main():
    print("=" * 70)
    print("Drug Interaction Search Graph - Example Usage")
    print("=" * 70)
    print()

    # Initialize graph
    print("1. Initializing graph...")
    graph = DrugInteractionGraph()
    print(f"   {graph}")
    print()

    # Load data from CSV
    print("2. Loading data from sample_data.csv...")
    start_time = time.time()
    count = graph.load_from_csv(data_filepath)
    load_time = time.time() - start_time
    print(f"   Loaded {count} interactions in {load_time * 1000:.2f}ms")
    print(f"   {graph}")
    print()

    # Display graph statistics
    print("3. Graph Statistics:")
    stats = graph.get_stats()
    print(f"   - Total drugs: {stats['drugs']}")
    print(f"   - Total interactions: {stats['interactions']}")
    print()

    # Search for specific interaction between two drugs
    print("4. Searching for specific drug-drug interactions:")
    print("-" * 70)

    test_pairs = [
        ("Warfarin", "Aspirin"),
        ("Aspirin", "Warfarin"),  # Test undirected (should work both ways)
        ("warfarin", "aspirin"),  # Test case-insensitivity
        ("Metformin", "Alcohol"),
        ("Aspirin", "Metformin"),  # Non-existent interaction
        ("Sildenafil", "Nitrates"),
    ]

    for drug1, drug2 in test_pairs:
        start_time = time.time()
        result = graph.search_interaction(drug1, drug2)
        search_time = time.time() - start_time

        if result:
            print(f"   ✓ {drug1} + {drug2}")
            print(f"     Condition: {result}")
            print(f"     Search time: {search_time * 1000000:.2f}µs")
        else:
            print(f"   ✗ {drug1} + {drug2}")
            print(f"     No interaction found")
            print(f"     Search time: {search_time * 1000000:.2f}µs")
        print()

    # Get all interactions for a specific drug
    print("5. Getting all interactions for specific drugs:")
    print("-" * 70)

    test_drugs = ["Warfarin", "Aspirin", "Metformin", "UnknownDrug"]

    for drug in test_drugs:
        start_time = time.time()
        interactions = graph.get_all_interactions_for_drug(drug)
        search_time = time.time() - start_time

        print(f"   Drug: {drug}")
        if interactions:
            print(f"   Found {len(interactions)} interaction(s):")
            for interaction in interactions:
                print(f"     • {interaction['drug']}: {interaction['condition']}")
        else:
            print(f"   No interactions found")
        print(f"   Search time: {search_time * 1000000:.2f}µs")
        print()

    # Add new interaction manually
    print("6. Adding new interaction manually:")
    print("-" * 70)
    graph.add_interaction("Acetaminophen", "Alcohol", "Hepatotoxicity risk")
    print("   Added: Acetaminophen + Alcohol -> Hepatotoxicity risk")
    print(f"   {graph}")
    print()

    # Verify the new interaction
    result = graph.search_interaction("Acetaminophen", "Alcohol")
    print(f"   Verification: {result}")
    print()

    # Performance benchmark with multiple searches
    print("7. Performance Benchmark:")
    print("-" * 70)
    num_searches = 1000

    start_time = time.time()
    for _ in range(num_searches):
        graph.search_interaction("Warfarin", "Aspirin")
    total_time = time.time() - start_time

    print(f"   Performed {num_searches} searches in {total_time * 1000:.2f}ms")
    print(f"   Average time per search: {(total_time / num_searches) * 1000000:.2f}µs")
    print(f"   Searches per second: {num_searches / total_time:.0f}")
    print()

    # Export to GraphML (optional - for visualization)
    print("8. Exporting to GraphML:")
    print("-" * 70)
    graph.export_to_graphml("drug_interactions.graphml")
    print("   Exported to drug_interactions.graphml")
    print("   Can be visualized with tools like Gephi, Cytoscape, or yEd")
    print()

    print("=" * 70)
    print("Demo completed successfully!")
    print("=" * 70)


if __name__ == "__main__":
    main()
