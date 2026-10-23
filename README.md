# Drug Interaction Search Graph

A Python-based graph data structure for efficiently storing and searching drug-drug interactions using the [igraph](https://igraph.org/python/) library.

**🚀 NEW: AI-Powered Conversational Agent!** Ask questions about drug interactions in natural language using LangChain and OpenAI. See [AI Agent with LangChain](#ai-agent-with-langchain) section below or check out the [Quick Start Guide](QUICK_START.md).

## Current TypeScript server and DDInter 2.0 data

The active `server/` backend uses the official [DDInter 2.0 category CSV exports](https://ddinter2.scbdd.com/download/). The earlier Python examples below are historical; their prebuilt GraphML, pickle, and NumPy artifacts are not used by the TypeScript server and were not migrated.

From `server/`:

```sh
pnpm install
pnpm data:download
pnpm data:build
pnpm start
```

Stop running backend processes before rebuilding, and restart them afterward: an already-open SQLite connection and resolver retain the previous catalog. `data:build` stages the database, name list, and embeddings before replacing active files; it does not hot-swap a running server. `APP_DB_PATH` session/cabinet data is not replaced.

- `data:download` downloads all eight files currently linked by the official page (ATC A, B, D, H, L, P, R, V), saves originals under `server/data/ddinter/raw/`, and replaces root `db_drug_interactions.csv` with deterministic, deduplicated records. The processed columns are `drug_1,drug_2,condition,drug_1_id,drug_2_id,level,source_rows`.
- `server/data/ddinter/manifest.json` records source URLs, retrieval times, original SHA-256 checksums, processed checksum, license, website update date, coverage, and counts. The same manifest is stored in SQLite `dataset_metadata`. The manifest and processed CSV are versioned; original downloads and generated database/vector files are local build artifacts.
- `data:build` verifies the processed CSV against the manifest, imports `server/data/ddi.sqlite`, and regenerates matching `drug-names.json` and 384-dimensional `drug-vectors.f32`. It does not import the old unprovenanced dataset or legacy GraphML. It can rebuild from the processed CSV and manifest without downloading again.
- The 2026-10-23 acquisition contains **222,383 source rows**, **62,148 overlapping rows**, **160,235 unique unordered interaction pairs**, and **1,939 drugs**. Pair risk levels: Major 26,914; Moderate 96,675; Minor 6,833; Unknown 29,813. These exports are **not the full 302,516 associations / 2,290 drugs advertised by the website** (website update date: 2024-05-14).
- Export columns contain identifiers, drug names, and risk levels only. `condition` in the processed CSV remains a generated, explicitly labelled risk summary—not an original mechanism description. Enriched runtime lookups prefer crawled source descriptions when available, with the full page evidence kept separately.
- Category overlaps are deduplicated by unordered DDInter IDs and risk level. Every original filename/CSV record number is preserved in `source_rows`; different source risk records/descriptions remain in `interaction_records` rather than overwriting one another. CSV endpoint order does not establish pharmacological direction.
- Report `source_records` carries DDInter IDs and risk levels. `severity_source` distinguishes DDInter from model estimates. Known DDInter severity overrides AI guesses; Unknown is not converted to minor/moderate. A grouped pair with Unknown and lower known risks remains unknown unless a major risk is established. Absence of a record never proves safety.
- Aliases for thiamine/B1, riboflavin/B2, and ubidecarenone/CoQ10 were removed because their targets are absent from the downloaded catalog; they are no longer guaranteed alias matches. Generic Vitamin D maps to the catalog's `Vitamin D`, while D3 maps to `Cholecalciferol`.
- Vector-only matching does not expand a broad input into a longer name with that exact prefix (for example, `Insulin` must not silently become `Insulin detemir`). Explicit forms and supported aliases still resolve. This is a conservative specificity check, not clinical validation of all name matches.
- Coverage gaps are real: the downloaded subset has no record for `Fluoxetine + Tramadol` or `Digoxin + Furosemide`, despite both drug names being available. The golden evaluation cases now reflect the imported subset, not a claim of clinical absence.

**Data license and attribution:** DDInter 2.0, curated by the DDInter team, <https://ddinter2.scbdd.com/>. Data and the processed derivative are provided under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), subject to [DDInter terms](https://ddinter2.scbdd.com/terms/); this migration deduplicates category exports and adds provenance and labelled risk summaries. The software license does not override the dataset license. Do not use the data commercially without appropriate permission. DDInter and this application do not guarantee completeness or clinical accuracy.

### Enrich only current interaction pairs

From `server/`:

```sh
pnpm data:crawl
pnpm data:crawl:status
```

`data:crawl` runs until discovery and the pending queue are exhausted or the process is stopped. It is a long-running foreground command; keep the machine awake. A single process starts requests on a shared clock (default one every 250 ms, at most 6 in flight, in a rolling pool) and respects access denials, robots restrictions, and HTTP 429 Retry-After deadlines; the first 403 or 429 halts all in-flight workers. Tune with `--concurrency=N` and `--interval-ms=N` (e.g. `pnpm data:crawl --concurrency=1 --interval-ms=1000` for the original one-request-per-second pace). DDInter publishes no crawl-rate rules, so keep the load modest. It uses direct HTTP, not browser automation or guessed sequential page bounds.

- The target snapshot is the existing catalog: **160,235 unordered drug pairs**. A greedy endpoint cover selects 906 current drug IDs for public, paginated `/server/interact-with/<drug-id>/` discovery. Only page IDs matching current source-ID pairs are queued for `/server/interact/<id>/`; out-of-catalog pairs are not imported.
- `server/data/ddinter/crawl.sqlite` checkpoints discovery offsets, queued/completed/missing/error pages, compressed source HTML, parsed evidence, page URLs, retrieval times, and SHA-256 hashes. An exclusive PID lock prevents duplicate crawler instances. Resume with the same command after interruption; completed pages are not downloaded again. The archive is tied to the exact target catalog.
- Each verified page is applied immediately to `interaction_details` in `server/data/ddi.sqlite`, keyed by source drug IDs. Drug names, pair membership, original CSV evidence, and imported severity are not replaced. Multiple website records for the same pair are retained.
- Extracted fields are the pair's interaction description, mechanism categories, management text, and references. A source `-` stays null. Alternative-drug lists and generic CYP footer advice are deliberately excluded; they are not personalized management guidance.
- Reports expose crawled evidence in `source_records[].details`, including per-page risk levels. Page/CSV risk disagreements remain visible; the imported CSV severity is not silently changed. The UI distinguishes source quotes from AI interpretation.
- Restart an already-running backend once to load the new lookup implementation/database handle. Subsequent successful imports become visible on new lookups without restarting it.
- Ctrl+C pauses a foreground crawl safely. For a background crawler, send SIGINT to the PID recorded in `server/data/ddinter/crawl.sqlite.lock`. Stop the crawler before `pnpm data:build`; rebuilding refuses while its lock is present and restores completed evidence from the archive into the staged database.
- For a bounded run after stopping any active crawler: `pnpm data:crawl --max-pages=10`. A specific known page can be checked with `pnpm data:crawl --page-ids=23`, but it must map to a current pair. Neither mode claims full enrichment.
- `completed` means all target pairs have at least one successfully fetched page and discovery is exhausted. `completed_with_gaps` means discovery finished but targets/pages remain missing; `paused` and `error` are not completion. Use live status counts rather than assuming every pair has already been enriched.

The category CSV coverage limit and CC BY-NC-SA 4.0 restrictions above still apply. Crawling existing pairs adds source annotations, not new interaction coverage or a claim of clinical validation.


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

The active TypeScript database is derived from DDInter 2.0's official downloads; see the acquisition, provenance, coverage, and licensing details above. The previous bundled dataset's original provider was not documented and is no longer the production build input.

## License

Software: MIT License. **DDInter data and its processed derivatives are separately licensed CC BY-NC-SA 4.0**, not MIT; see the data licensing section above.

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
