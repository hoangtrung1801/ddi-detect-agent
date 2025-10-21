"""
Drug Interaction Search Graph

A graph-based data structure for efficiently searching drug-drug interactions
using the igraph library.
"""

import igraph as ig
import csv
import json
from typing import Optional, List, Dict, Tuple, Any


class DrugInteractionGraph:
    """
    A graph-based structure for storing and searching drug-drug interactions.

    Uses igraph.Graph for efficient graph operations with:
    - Vertices: Drug nodes with name attributes
    - Edges: Undirected edges with condition attributes
    - Auxiliary index for O(1) drug name lookups
    """

    def __init__(self, filepath: Optional[str] = None):
        """Initialize an empty drug interaction graph."""
        if filepath:
            self.graph = ig.read(filepath)
            self._load_name_to_vertex()
        else:
            self.graph = ig.Graph(directed=False)
            self.graph.vs["name"] = []
            self.graph.vs["name_normalized"] = []
            # Auxiliary index: normalized drug name -> vertex ID
            self._name_to_vertex = {}

    def _load_name_to_vertex(self) -> None:
        """Load the name_to_vertex dictionary from the graph."""
        self._name_to_vertex = {}
        for v in self.graph.vs:
            self._name_to_vertex[v["name_normalized"]] = v.index

    def _normalize_name(self, name: str) -> str:
        """Normalize drug name for case-insensitive searching."""
        return name.strip().lower()

    def _get_or_create_vertex(self, drug_name: str) -> int:
        """
        Get vertex ID for a drug name, creating it if it doesn't exist.

        Args:
            drug_name: Name of the drug

        Returns:
            Vertex ID
        """
        normalized = self._normalize_name(drug_name)

        if normalized in self._name_to_vertex:
            return self._name_to_vertex[normalized]

        # Create new vertex
        vertex_id = self.graph.vcount()
        self.graph.add_vertices(1)
        self.graph.vs[vertex_id]["name"] = drug_name.strip()
        self.graph.vs[vertex_id]["name_normalized"] = normalized
        self._name_to_vertex[normalized] = vertex_id

        return vertex_id

    def add_interaction(self, drug1: str, drug2: str, condition: str) -> None:
        """
        Add a drug-drug interaction to the graph.

        If the interaction already exists, updates the condition.

        Args:
            drug1: First drug name
            drug2: Second drug name
            condition: Interaction condition/effect
        """
        v1 = self._get_or_create_vertex(drug1)
        v2 = self._get_or_create_vertex(drug2)

        # Check if edge already exists
        edge_id = self.graph.get_eid(v1, v2, error=False)

        if edge_id == -1:
            # Create new edge
            self.graph.add_edge(v1, v2, condition=condition)
        else:
            # Update existing edge condition
            self.graph.es[edge_id]["condition"] = condition

    def load_from_csv(self, filepath: str) -> int:
        """
        Load drug interactions from a CSV file.

        Expected CSV format: drug1,drug2,condition
        First row is treated as header and skipped.

        Args:
            filepath: Path to CSV file

        Returns:
            Number of interactions loaded
        """
        import sys

        count = 0
        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            total = len(rows)
            for i, row in enumerate(rows, 1):
                # Accept both 'drug1' or 'drug_1' as column names for robustness
                drug1 = row.get("drug1", row.get("drug_1"))
                drug2 = row.get("drug2", row.get("drug_2"))
                condition = row.get("condition")
                self.add_interaction(drug1, drug2, condition)
                count += 1
                # Simple progress indicator (prints every 10 or last row)
                if total > 20:
                    if i % (total // 20) == 0 or i == total:
                        progress = int(50 * i / total)
                        bar = "#" * progress + "-" * (50 - progress)
                        print(f"\rLoading CSV: [{bar}] {i}/{total}", end="")
                        sys.stdout.flush()
            if total > 20:
                print()  # Move to next line after progress bar
        return count

    def load_from_json(self, filepath: str) -> int:
        """
        Load drug interactions from a JSON file.

        Expected JSON format: [{"drug1": "...", "drug2": "...", "condition": "..."}, ...]

        Args:
            filepath: Path to JSON file

        Returns:
            Number of interactions loaded
        """
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        count = 0
        for item in data:
            self.add_interaction(item["drug1"], item["drug2"], item["condition"])
            count += 1
        return count

    def search_interaction(self, drug1: str, drug2: str) -> Optional[str]:
        """
        Search for an interaction between two specific drugs.

        Args:
            drug1: First drug name
            drug2: Second drug name

        Returns:
            Condition string if interaction exists, None otherwise
        """
        normalized1 = self._normalize_name(drug1)
        normalized2 = self._normalize_name(drug2)

        # Check if both drugs exist
        if (
            normalized1 not in self._name_to_vertex
            or normalized2 not in self._name_to_vertex
        ):
            return None

        v1 = self._name_to_vertex[normalized1]
        v2 = self._name_to_vertex[normalized2]

        # Get edge between vertices
        edge_id = self.graph.get_eid(v1, v2, error=False)

        if edge_id == -1:
            return None

        return self.graph.es[edge_id]["condition"]

    def search_all_interactions(self, drug1: str, drug2: str) -> List[Dict[str, str]]:
        """
        Search for all interactions between two drugs.
        """
        normalized1 = self._normalize_name(drug1)
        normalized2 = self._normalize_name(drug2)

        if (
            normalized1 not in self._name_to_vertex
            or normalized2 not in self._name_to_vertex
        ):
            return []

        v1 = self._name_to_vertex[normalized1]
        v2 = self._name_to_vertex[normalized2]

        interactions = []
        for e in self.graph.es:
            if e.source == v1 or e.target == v2:
                interactions.append(
                    e["condition"],
                )
            elif e.source == v2 or e.target == v1:
                interactions.append(
                    e["condition"],
                )

        return interactions

        # edge_ids = self.graph.get_eids(v1, v2, error=False)
        # interactions = []
        # for edge_id in edge_ids:
        #     interactions.append(
        #         {
        #             "drug": self.graph.vs[edge_id]["name"],
        #             "condition": self.graph.es[edge_id]["condition"],
        #         }
        #     )

        # return interactions

        # edges = self.graph.es.select(_source=v1, _target=v2)
        # return [
        #     {
        #         "drug": self.graph.vs[edge.target]["name"],
        #         "condition": edge["condition"],
        #     }
        #     for edge in edges
        # ]

    def get_all_interactions_for_drug(self, drug_name: str) -> List[Dict[str, str]]:
        """
        Get all interactions for a specific drug.

        Args:
            drug_name: Name of the drug

        Returns:
            List of dictionaries with keys: 'drug', 'condition'
        """
        normalized = self._normalize_name(drug_name)

        if normalized not in self._name_to_vertex:
            return []

        vertex_id = self._name_to_vertex[normalized]

        # Get all neighbors (connected drugs)
        neighbors = self.graph.neighbors(vertex_id)

        interactions = []
        for neighbor_id in neighbors:
            edge_id = self.graph.get_eid(vertex_id, neighbor_id)
            interactions.append(
                {
                    "drug": self.graph.vs[neighbor_id]["name"],
                    "condition": self.graph.es[edge_id]["condition"],
                }
            )

        return interactions

    def get_stats(self) -> Dict[str, int]:
        """
        Get graph statistics.

        Returns:
            Dictionary with 'drugs' (vertex count) and 'interactions' (edge count)
        """
        return {"drugs": self.graph.vcount(), "interactions": self.graph.ecount()}

    def export_to_graphml(self, filepath: str) -> None:
        """
        Export graph to GraphML format for visualization.

        Args:
            filepath: Path to output GraphML file
        """
        self.graph.write_graphml(filepath)

    def visualize(
        self,
        highlight_drug: Optional[str] = None,
        layout: str = "auto",
        save_path: Optional[str] = None,
        figsize: Tuple[int, int] = (12, 10),
        show_labels: bool = True,
    ) -> Any:
        """
        Visualize the drug interaction graph using matplotlib.

        Args:
            highlight_drug: Optional drug name to highlight with its connections
            layout: Layout algorithm ('auto', 'circle', 'kamada_kawai', 'spring', 'random')
            save_path: Optional path to save the visualization
            figsize: Figure size as (width, height)
            show_labels: Whether to show drug names as labels

        Returns:
            matplotlib figure object
        """
        try:
            import matplotlib.pyplot as plt
            import networkx as nx
        except ImportError:
            raise ImportError(
                "matplotlib and networkx are required for visualization. "
                "Install with: pip install matplotlib networkx"
            )

        # Convert igraph to networkx for easier matplotlib plotting
        nx_graph = nx.Graph()

        # Add nodes
        for v in self.graph.vs:
            nx_graph.add_node(v.index, name=v["name"])

        # Add edges
        for e in self.graph.es:
            source, target = e.tuple
            nx_graph.add_edge(source, target, condition=e["condition"])

        # Create figure
        fig, ax = plt.subplots(figsize=figsize)

        # Choose layout
        if layout == "circle":
            pos = nx.circular_layout(nx_graph)
        elif layout == "kamada_kawai":
            pos = nx.kamada_kawai_layout(nx_graph)
        elif layout == "spring":
            pos = nx.spring_layout(nx_graph, k=2, iterations=50)
        elif layout == "random":
            pos = nx.random_layout(nx_graph)
        else:  # auto
            pos = nx.spring_layout(nx_graph, k=1.5, iterations=50, seed=42)

        # Determine node colors
        node_colors = []
        node_sizes = []
        highlight_vertex_id = None

        if highlight_drug:
            normalized = self._normalize_name(highlight_drug)
            highlight_vertex_id = self._name_to_vertex.get(normalized)

        for node in nx_graph.nodes():
            if highlight_vertex_id is not None:
                if node == highlight_vertex_id:
                    node_colors.append("#FF4444")  # Red for highlighted drug
                    node_sizes.append(1200)
                elif node in nx_graph.neighbors(highlight_vertex_id):
                    node_colors.append("#FFA500")  # Orange for connected drugs
                    node_sizes.append(800)
                else:
                    node_colors.append("#B0B0B0")  # Gray for others
                    node_sizes.append(400)
            else:
                # Color by degree (number of connections)
                degree = nx_graph.degree(node)
                if degree > 5:
                    node_colors.append("#FF6B6B")
                elif degree > 3:
                    node_colors.append("#FFA500")
                elif degree > 1:
                    node_colors.append("#4ECDC4")
                else:
                    node_colors.append("#95E1D3")
                node_sizes.append(300 + degree * 100)

        # Draw edges
        nx.draw_networkx_edges(
            nx_graph, pos, alpha=0.3, width=2, edge_color="#888888", ax=ax
        )

        # Draw nodes
        nx.draw_networkx_nodes(
            nx_graph,
            pos,
            node_color=node_colors,
            node_size=node_sizes,
            alpha=0.9,
            ax=ax,
        )

        # Draw labels
        if show_labels:
            labels = {node: self.graph.vs[node]["name"] for node in nx_graph.nodes()}
            nx.draw_networkx_labels(
                nx_graph, pos, labels, font_size=8, font_weight="bold", ax=ax
            )

        # Title
        if highlight_drug:
            ax.set_title(
                f"Drug Interaction Network\nHighlighting: {highlight_drug}",
                fontsize=16,
                fontweight="bold",
            )
        else:
            stats = self.get_stats()
            ax.set_title(
                f"Drug Interaction Network\n{stats['drugs']} drugs, {stats['interactions']} interactions",
                fontsize=16,
                fontweight="bold",
            )

        ax.axis("off")
        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches="tight")
            print(f"Visualization saved to {save_path}")

        return fig

    def visualize_interactive(
        self, highlight_drug: Optional[str] = None, save_path: Optional[str] = None
    ) -> Any:
        """
        Create an interactive visualization using Plotly.

        Args:
            highlight_drug: Optional drug name to highlight with its connections
            save_path: Optional path to save the HTML file

        Returns:
            plotly figure object
        """
        try:
            import plotly.graph_objects as go
            import networkx as nx
        except ImportError:
            raise ImportError(
                "plotly and networkx are required for interactive visualization. "
                "Install with: pip install plotly networkx"
            )

        # Convert to networkx
        nx_graph = nx.Graph()
        for v in self.graph.vs:
            nx_graph.add_node(v.index, name=v["name"])
        for e in self.graph.es:
            source, target = e.tuple
            nx_graph.add_edge(source, target, condition=e["condition"])

        # Layout
        pos = nx.spring_layout(nx_graph, k=1.5, iterations=50, seed=42)

        # Create edge traces
        edge_trace = go.Scatter(
            x=[],
            y=[],
            line=dict(width=1, color="#888"),
            hoverinfo="none",
            mode="lines",
        )

        for edge in nx_graph.edges():
            x0, y0 = pos[edge[0]]
            x1, y1 = pos[edge[1]]
            edge_trace["x"] += (x0, x1, None)
            edge_trace["y"] += (y0, y1, None)

        # Create node traces
        highlight_vertex_id = None
        if highlight_drug:
            normalized = self._normalize_name(highlight_drug)
            highlight_vertex_id = self._name_to_vertex.get(normalized)

        node_x = []
        node_y = []
        node_text = []
        node_color = []
        node_size = []

        for node in nx_graph.nodes():
            x, y = pos[node]
            node_x.append(x)
            node_y.append(y)

            drug_name = self.graph.vs[node]["name"]
            degree = nx_graph.degree(node)
            interactions = self.get_all_interactions_for_drug(drug_name)

            hover_text = f"<b>{drug_name}</b><br>"
            hover_text += f"Connections: {degree}<br><br>"
            if interactions:
                hover_text += "<b>Interactions:</b><br>"
                for i, interaction in enumerate(interactions[:5]):
                    hover_text += f"• {interaction['drug']}<br>"
                if len(interactions) > 5:
                    hover_text += f"... and {len(interactions) - 5} more"

            node_text.append(hover_text)

            # Color and size logic
            if highlight_vertex_id is not None:
                if node == highlight_vertex_id:
                    node_color.append("#FF4444")
                    node_size.append(30)
                elif node in nx_graph.neighbors(highlight_vertex_id):
                    node_color.append("#FFA500")
                    node_size.append(20)
                else:
                    node_color.append("#B0B0B0")
                    node_size.append(10)
            else:
                node_color.append(degree)
                node_size.append(10 + degree * 2)

        node_trace = go.Scatter(
            x=node_x,
            y=node_y,
            mode="markers+text",
            hoverinfo="text",
            text=[self.graph.vs[node]["name"] for node in nx_graph.nodes()],
            hovertext=node_text,
            textposition="top center",
            textfont=dict(size=8),
            marker=dict(
                showscale=highlight_vertex_id is None,
                colorscale="YlOrRd",
                size=node_size,
                color=node_color,
                colorbar=dict(
                    thickness=15,
                    title="Connections",
                    xanchor="left",
                    titleside="right",
                ),
                line=dict(width=2, color="white"),
            ),
        )

        # Create figure
        fig = go.Figure(
            data=[edge_trace, node_trace],
            layout=go.Layout(
                title=dict(
                    text=f"Drug Interaction Network<br><sub>{self.get_stats()['drugs']} drugs, {self.get_stats()['interactions']} interactions</sub>",
                    x=0.5,
                    xanchor="center",
                ),
                showlegend=False,
                hovermode="closest",
                margin=dict(b=0, l=0, r=0, t=40),
                xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                plot_bgcolor="white",
            ),
        )

        if save_path:
            fig.write_html(save_path)
            print(f"Interactive visualization saved to {save_path}")

        return fig

    def __len__(self) -> int:
        """Return the number of interactions (edges) in the graph."""
        return self.graph.ecount()

    def __str__(self) -> str:
        """String representation of the graph."""
        stats = self.get_stats()
        return f"DrugInteractionGraph(drugs={stats['drugs']}, interactions={stats['interactions']})"
