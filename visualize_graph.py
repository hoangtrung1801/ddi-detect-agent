"""
Visualization Script for Drug Interaction Graph

Demonstrates various visualization options for the drug interaction network.
"""

from drug_interaction_graph import DrugInteractionGraph
import matplotlib.pyplot as plt

data_filepath = "TWOSIDES_preprocessed.csv"


def main():
    print("=" * 70)
    print("Drug Interaction Graph Visualization")
    print("=" * 70)
    print()

    # Load the graph
    print("Loading drug interaction data...")
    graph = DrugInteractionGraph("drug_interactions.graphml")
    # graph.load_from_csv("sample_data.csv")
    stats = graph.get_stats()
    print(f"Loaded {stats['drugs']} drugs with {stats['interactions']} interactions")
    print()

    # 1. Basic visualization
    print("1. Creating basic network visualization...")
    fig = graph.visualize(
        layout="spring", save_path="drug_network_basic.png", figsize=(14, 12)
    )
    plt.show()
    print()

    # 2. Highlight specific drug
    print("2. Creating visualization highlighting Warfarin...")
    fig = graph.visualize(
        highlight_drug="Warfarin",
        layout="spring",
        save_path="drug_network_warfarin.png",
        figsize=(14, 12),
    )
    plt.show()
    print()

    # 3. Different layout - circular
    print("3. Creating circular layout visualization...")
    fig = graph.visualize(
        layout="circle", save_path="drug_network_circular.png", figsize=(14, 12)
    )
    plt.show()
    print()

    # 4. Highlight another drug
    print("4. Creating visualization highlighting Aspirin...")
    fig = graph.visualize(
        highlight_drug="Aspirin",
        layout="spring",
        save_path="drug_network_aspirin.png",
        figsize=(14, 12),
    )
    plt.show()
    print()

    # 5. Interactive visualization
    print("5. Creating interactive Plotly visualization...")
    try:
        fig_interactive = graph.visualize_interactive(
            save_path="drug_network_interactive.html"
        )
        print("   Interactive visualization created!")
        print("   Open 'drug_network_interactive.html' in a web browser")
        print()
    except ImportError as e:
        print(f"   Skipping interactive visualization: {e}")
        print()

    # 6. Interactive with highlight
    print("6. Creating interactive visualization highlighting Warfarin...")
    try:
        fig_interactive = graph.visualize_interactive(
            highlight_drug="Warfarin",
            save_path="drug_network_interactive_warfarin.html",
        )
        print("   Interactive visualization created!")
        print("   Open 'drug_network_interactive_warfarin.html' in a web browser")
        print()
    except ImportError as e:
        print(f"   Skipping interactive visualization: {e}")
        print()

    # 7. Show drugs with most interactions
    print("7. Analyzing drugs with most interactions:")
    print("-" * 70)

    drug_connections = {}
    for v in graph.graph.vs:
        drug_name = v["name"]
        interactions = graph.get_all_interactions_for_drug(drug_name)
        drug_connections[drug_name] = len(interactions)

    # Sort by number of connections
    sorted_drugs = sorted(drug_connections.items(), key=lambda x: x[1], reverse=True)

    print("   Top 10 drugs by number of interactions:")
    for i, (drug, count) in enumerate(sorted_drugs[:10], 1):
        print(f"   {i:2d}. {drug:30s} - {count} interactions")
    print()

    # 8. Create visualization for a highly connected drug
    if sorted_drugs:
        top_drug = sorted_drugs[0][0]
        print(f"8. Creating visualization highlighting {top_drug} (most connected)...")
        fig = graph.visualize(
            highlight_drug=top_drug,
            layout="spring",
            save_path=f"drug_network_{top_drug.lower().replace(' ', '_')}.png",
            figsize=(14, 12),
        )
        plt.show()
        print()

    print("=" * 70)
    print("Visualization completed!")
    print()
    print("Generated files:")
    print("  - drug_network_basic.png")
    print("  - drug_network_warfarin.png")
    print("  - drug_network_circular.png")
    print("  - drug_network_aspirin.png")
    print("  - drug_network_interactive.html")
    print("  - drug_network_interactive_warfarin.html")
    if sorted_drugs:
        print(f"  - drug_network_{sorted_drugs[0][0].lower().replace(' ', '_')}.png")
    print("=" * 70)


if __name__ == "__main__":
    main()
