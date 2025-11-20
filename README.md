# Drug Interaction Search Graph

A Python-based graph data structure for efficiently storing and searching drug-drug interactions using the [igraph](https://igraph.org/python/) library.

**🚀 NEW: AI-Powered Conversational Agent!** Ask questions about drug interactions in natural language using LangChain and OpenAI. See [AI Agent with LangChain](#ai-agent-with-langchain) section below or check out the [Quick Start Guide](QUICK_START.md).

## Features

- **Fast lookups**: O(1) average time complexity for finding interactions between two drugs
- **Case-insensitive search**: Search by drug name regardless of capitalization
- **Undirected edges**: Interaction between Drug A and Drug B works both ways
- **Scalable**: Efficiently handles large datasets (>10k interactions)
- **Multiple data formats**: Load data from CSV or JSON files
- **Built-in visualization**: Static (matplotlib) and interactive (Plotly) visualizations
- **Graph export**: Export to GraphML format for external visualization tools

## Data Structure

- **Vertices**: Drug nodes with name attributes
- **Edges**: Undirected edges representing interactions with condition attributes
- **Auxiliary index**: Dictionary mapping normalized drug names to vertex IDs for O(1) lookup

```
{drug1, drug2, condition}
```

## Installation

### Prerequisites

Python 3.7 or higher is required.

### Install Dependencies

igraph can be tricky to install depending on your system. Here are the recommended approaches:

**Option 1: Using pip (recommended)**
```bash
pip install -r requirements.txt
```

**Option 2: If you encounter issues with igraph installation**

On macOS:
```bash
brew install igraph
pip install python-igraph
```

On Ubuntu/Debian:
```bash
sudo apt-get install python3-igraph
```

On Windows:
- Download precompiled wheels from [Christoph Gohlke's page](https://www.lfd.uci.edu/~gohlke/pythonlibs/#python-igraph)
- Or use: `pip install python-igraph`

## Usage

### Basic Example

```python
from drug_interaction_graph import DrugInteractionGraph

# Initialize graph
graph = DrugInteractionGraph()

# Add interactions manually
graph.add_interaction("Warfarin", "Aspirin", "Increased bleeding risk")
graph.add_interaction("Metformin", "Alcohol", "Lactic acidosis risk")

# Search for interaction between two drugs
condition = graph.search_interaction("Warfarin", "Aspirin")
print(condition)  # Output: "Increased bleeding risk"

# Search is case-insensitive and bidirectional
condition = graph.search_interaction("aspirin", "warfarin")
print(condition)  # Output: "Increased bleeding risk"

# Get all interactions for a specific drug
interactions = graph.get_all_interactions_for_drug("Warfarin")
for interaction in interactions:
    print(f"{interaction['drug']}: {interaction['condition']}")
```

### Loading Data from Files

**CSV Format:**
```csv
drug1,drug2,condition
Warfarin,Aspirin,Increased bleeding risk
Metformin,Alcohol,Lactic acidosis risk
```

```python
graph = DrugInteractionGraph()
graph.load_from_csv("interactions.csv")
```

**JSON Format:**
```json
[
  {"drug1": "Warfarin", "drug2": "Aspirin", "condition": "Increased bleeding risk"},
  {"drug1": "Metformin", "drug2": "Alcohol", "condition": "Lactic acidosis risk"}
]
```

```python
graph = DrugInteractionGraph()
graph.load_from_json("interactions.json")
```

### Running the Example

```bash
python example_usage.py
```

This will demonstrate:
- Loading data from CSV
- Searching for specific interactions
- Getting all interactions for a drug
- Performance benchmarking
- Exporting to GraphML

### Visualizing the Graph

```bash
python visualize_graph.py
```

This creates multiple visualizations:
- Basic network visualization
- Highlighted drug interactions
- Different layout styles (spring, circular)
- Interactive HTML visualizations

## AI Agent with LangChain

An intelligent conversational agent powered by OpenAI and LangChain that uses the DrugInteractionGraph to answer natural language questions about drug interactions.

### Features

- **Natural Language Interface**: Ask questions in plain English
- **Conversation Memory**: Maintains context across multiple queries
- **Smart Tool Selection**: Automatically chooses the right tool (search between two drugs or get all interactions for one drug)
- **Multiple Interfaces**: Command-line interface (CLI) and REST API

### Setup

1. **Install Dependencies**:
```bash
pip install -r requirements.txt
```

2. **Configure OpenAI API Key**:

Create a `.env` file in the project root:
```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo
DATA_FILE=TWOSIDES_preprocessed.csv
```

Or export the environment variable:
```bash
export OPENAI_API_KEY="your_openai_api_key_here"
```

### Using the CLI

Run the interactive command-line interface:

```bash
python drug_agent_cli.py
```

**Example Conversation**:
```
You: What happens if I take Warfarin and Aspirin together?
Agent: [Provides interaction information]

You: Show me all interactions for Metformin
Agent: [Lists all Metformin interactions]

You: Is it safe to combine them?
Agent: [Uses conversation context to provide relevant answer]
```

**Available Commands**:
- `/exit` or `/quit` - Exit the application
- `/clear` - Clear conversation history
- `/stats` - Show database statistics
- `/help` - Show help message

### Using the REST API

1. **Start the API Server**:
```bash
python drug_agent_api.py
```

Or using uvicorn directly:
```bash
uvicorn drug_agent_api:app --reload --host 0.0.0.0 --port 8000
```

2. **Access the API**:

The API will be available at `http://localhost:8000`

**Interactive Documentation**: Visit `http://localhost:8000/docs` for Swagger UI

3. **API Endpoints**:

**Simple Query** (no session management):
```bash
curl -X POST "http://localhost:8000/query" \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the interactions between Warfarin and Aspirin?"}'
```

**Chat with Session** (maintains conversation history):
```bash
# First message
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the interactions for Metformin?"}'

# Follow-up (use session_id from response)
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{"question": "What about Warfarin?", "session_id": "your-session-id"}'
```

**Get Statistics**:
```bash
curl -X GET "http://localhost:8000/stats"
```

**Health Check**:
```bash
curl -X GET "http://localhost:8000/health"
```

**Clear Session**:
```bash
curl -X DELETE "http://localhost:8000/chat/{session_id}"
```

### Programmatic Usage

```python
from drug_agent import create_agent

# Create agent with data loaded
agent = create_agent(
    data_filepath="TWOSIDES_preprocessed.csv",
    model_name="gpt-3.5-turbo",
    verbose=True
)

# Ask questions
response = agent.query("What happens if I take Warfarin and Aspirin?")
print(response)

# Get all interactions for a drug
response = agent.query("Show me all interactions for Metformin")
print(response)

# Clear conversation history
agent.clear_memory()

# Get database statistics
stats = agent.get_graph_stats()
print(f"Drugs: {stats['drugs']}, Interactions: {stats['interactions']}")
```

### Example Questions

The agent can handle various types of natural language questions:

**Specific Drug Pairs**:
- "What happens if I take Warfarin and Aspirin together?"
- "Can I combine Ibuprofen with Alcohol?"
- "Is there an interaction between Metformin and Insulin?"

**Single Drug Interactions**:
- "Show me all interactions for Warfarin"
- "What drugs interact with Metformin?"
- "List all interactions for Aspirin"

**Conversational Follow-ups**:
- "What about other blood thinners?" (after discussing Warfarin)
- "Are there any other concerns?" (continuing previous context)
- "Is it dangerous?" (referring to previously mentioned interaction)

### Agent Architecture

The agent uses:
- **LangChain**: Agent framework with tool selection
- **OpenAI GPT**: Language model for understanding and generation
- **DrugInteractionGraph**: Knowledge base for drug interactions
- **ConversationBufferMemory**: Maintains conversation history

**Tools Available to Agent**:
1. `SearchDrugInteraction`: Search interaction between two specific drugs
2. `GetAllDrugInteractions`: Get all interactions for a single drug

### Configuration Options

**Environment Variables**:
```bash
OPENAI_API_KEY=sk-...           # Required: Your OpenAI API key
OPENAI_MODEL=gpt-3.5-turbo      # Optional: Model selection (gpt-3.5-turbo or gpt-4)
DATA_FILE=TWOSIDES_preprocessed.csv  # Optional: Path to data file
API_HOST=0.0.0.0                # Optional: API host
API_PORT=8000                   # Optional: API port
API_RELOAD=true                 # Optional: Auto-reload on code changes
```

**Model Selection**:
- `gpt-3.5-turbo`: Faster, more cost-effective (recommended for most use cases)
- `gpt-4`: More capable, higher accuracy (recommended for complex queries)

## Visualization

### Static Visualization (Matplotlib)

```python
# Basic visualization
fig = graph.visualize(layout="spring", save_path="network.png")

# Highlight a specific drug
fig = graph.visualize(
    highlight_drug="Warfarin",
    layout="spring",
    save_path="warfarin_network.png",
    figsize=(14, 12)
)

# Different layouts: 'auto', 'circle', 'kamada_kawai', 'spring', 'random'
fig = graph.visualize(layout="circle")
```

### Interactive Visualization (Plotly)

```python
# Create interactive HTML visualization
fig = graph.visualize_interactive(save_path="interactive_network.html")

# Highlight specific drug in interactive mode
fig = graph.visualize_interactive(
    highlight_drug="Aspirin",
    save_path="aspirin_interactive.html"
)
```

The interactive visualization includes:
- Hover over nodes to see drug details and interactions
- Zoom and pan functionality
- Color-coded nodes by number of connections
- Click and drag to explore the network

## API Reference

### `DrugInteractionGraph`

#### `__init__()`
Initialize an empty drug interaction graph.

#### `add_interaction(drug1: str, drug2: str, condition: str) -> None`
Add a drug-drug interaction. If the interaction already exists, updates the condition.

**Parameters:**
- `drug1`: First drug name
- `drug2`: Second drug name
- `condition`: Interaction condition/effect

#### `load_from_csv(filepath: str) -> int`
Load interactions from a CSV file.

**Parameters:**
- `filepath`: Path to CSV file (format: drug1,drug2,condition)

**Returns:**
- Number of interactions loaded

#### `load_from_json(filepath: str) -> int`
Load interactions from a JSON file.

**Parameters:**
- `filepath`: Path to JSON file

**Returns:**
- Number of interactions loaded

#### `search_interaction(drug1: str, drug2: str) -> Optional[str]`
Search for an interaction between two specific drugs.

**Parameters:**
- `drug1`: First drug name (case-insensitive)
- `drug2`: Second drug name (case-insensitive)

**Returns:**
- Condition string if interaction exists, None otherwise

#### `get_all_interactions_for_drug(drug_name: str) -> List[Dict[str, str]]`
Get all interactions for a specific drug.

**Parameters:**
- `drug_name`: Name of the drug (case-insensitive)

**Returns:**
- List of dictionaries with keys: 'drug', 'condition'

#### `get_stats() -> Dict[str, int]`
Get graph statistics.

**Returns:**
- Dictionary with 'drugs' (vertex count) and 'interactions' (edge count)

#### `export_to_graphml(filepath: str) -> None`
Export graph to GraphML format for visualization in tools like Gephi, Cytoscape, or yEd.

**Parameters:**
- `filepath`: Path to output GraphML file

#### `visualize(highlight_drug=None, layout='auto', save_path=None, figsize=(12, 10), show_labels=True)`
Create a static visualization using matplotlib.

**Parameters:**
- `highlight_drug`: Optional drug name to highlight with its connections
- `layout`: Layout algorithm ('auto', 'circle', 'kamada_kawai', 'spring', 'random')
- `save_path`: Optional path to save the PNG image
- `figsize`: Figure size as (width, height) tuple
- `show_labels`: Whether to show drug names as labels

**Returns:**
- matplotlib figure object

#### `visualize_interactive(highlight_drug=None, save_path=None)`
Create an interactive visualization using Plotly.

**Parameters:**
- `highlight_drug`: Optional drug name to highlight with its connections
- `save_path`: Optional path to save the HTML file

**Returns:**
- plotly figure object

## Performance

The graph uses igraph's efficient C-based backend along with an auxiliary Python dictionary index, providing:

- **Search between two drugs**: O(1) average time complexity (~1-5 microseconds)
- **Get all interactions for a drug**: O(d) where d is the degree of the drug node
- **Add interaction**: O(1) average time complexity
- **Load from file**: O(n) where n is the number of interactions

Typical performance on a modern laptop:
- ~1000 searches per millisecond
- Handles 100k+ interactions efficiently
- Minimal memory overhead

## Use Cases

- Clinical decision support systems
- Drug safety databases
- Pharmaceutical research
- Medical education tools
- Prescription validation systems

## Data Sources

This library is designed to work with drug interaction data from sources such as:
- DrugBank
- FDA Adverse Event Reporting System (FAERS)
- SIDER (Side Effect Resource)
- Custom pharmaceutical databases

## License

MIT License - feel free to use in your projects!

## Contributing

Contributions are welcome! Areas for potential enhancement:
- Support for interaction severity levels
- Multiple conditions per interaction
- Drug class/category grouping
- Pathway/mechanism information
- Time-series interaction data

## External Visualization Tools

After exporting to GraphML, you can also use external tools:

- **Gephi**: Open source network visualization ([gephi.org](https://gephi.org))
- **Cytoscape**: Network analysis platform ([cytoscape.org](https://cytoscape.org))
- **yEd**: Free diagram editor ([yworks.com/yed](https://www.yworks.com/products/yed))

Example workflow:
1. Export: `graph.export_to_graphml("interactions.graphml")`
2. Open the file in your visualization tool
3. Apply layout algorithms (force-directed, circular, etc.)
4. Color nodes/edges by drug class or interaction severity
