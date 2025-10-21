"""
Quick visualization example - minimal code to visualize the drug interaction graph
"""

from drug_interaction_graph import DrugInteractionGraph
import matplotlib.pyplot as plt

# Load the graph
graph = DrugInteractionGraph()
graph.load_from_csv("sample_data.csv")

print(f"Loaded: {graph}")
print()

# Option 1: Basic visualization
print("Creating basic visualization...")
fig = graph.visualize(layout="spring")
plt.savefig("drug_network.png", dpi=300, bbox_inches="tight")
print("Saved: drug_network.png")
plt.show()

# Option 2: Highlight a specific drug (e.g., Warfarin)
print("\nCreating visualization with Warfarin highlighted...")
fig = graph.visualize(highlight_drug="Warfarin", layout="spring")
plt.savefig("warfarin_highlighted.png", dpi=300, bbox_inches="tight")
print("Saved: warfarin_highlighted.png")
plt.show()

# Option 3: Interactive visualization (opens in browser)
print("\nCreating interactive visualization...")
fig = graph.visualize_interactive(save_path="interactive_network.html")
print("Saved: interactive_network.html (open in web browser)")

print("\n✓ Visualization complete!")
