# Suggested Commands for Development

## Environment Setup

### Initial Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Then edit .env to add OPENAI_API_KEY

# Or set environment variable directly
export OPENAI_API_KEY="sk-your-key-here"
```

### Virtual Environment (Recommended)
```bash
# Create virtual environment
python3 -m venv venv

# Activate (macOS/Linux)
source venv/bin/activate

# Deactivate
deactivate
```

## Running the Application

### FastAPI Server (New Refactored API)
```bash
# Using main.py (recommended)
python app/main.py

# Or using uvicorn directly
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Access API docs
open http://localhost:8000/docs
```

### Legacy Standalone API
```bash
python drug_agent_api.py
```

### CLI Interface
```bash
# Interactive CLI
python drug_agent_cli.py
```

### Example Scripts
```bash
# Basic usage examples
python example_usage.py

# Quick test
python quick_test.py

# Visualization
python visualize_graph.py
python quick_visualize.py
```

## Testing

### Run Tests
```bash
# Test LangGraph agent (new implementation)
python test_langgraph_agent.py

# Test legacy agent
python test_agent.py

# Test refactored API
python test_refactored_api.py

# Quick validation
python quick_test.py
```

**Note**: No pytest or unittest configuration found. Tests are standalone Python scripts.

## Data Management

### Check Data Files
```bash
# List data files
ls -lh *.csv *.graphml

# View CSV header
head -n 5 TWOSIDES_preprocessed.csv

# Count interactions
wc -l TWOSIDES_preprocessed.csv
```

### Generate GraphML
```python
# In Python
from drug_interaction_graph import DrugInteractionGraph
graph = DrugInteractionGraph()
graph.load_from_csv("TWOSIDES_preprocessed.csv")
graph.export_to_graphml("drug_interactions.graphml")
```

## API Testing with curl

### Health Check
```bash
curl http://localhost:8000/health
```

### Simple Query
```bash
curl -X POST "http://localhost:8000/query" \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the interactions between Warfarin and Aspirin?"}'
```

### Chat with Session
```bash
# First message
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{"question": "Tell me about Warfarin"}'

# Follow-up (use session_id from response)
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{"question": "What drugs interact with it?", "session_id": "SESSION_ID_HERE"}'
```

### Get Statistics
```bash
curl http://localhost:8000/stats
```

### Clear Session
```bash
curl -X DELETE "http://localhost:8000/chat/SESSION_ID_HERE"
```

## Development Workflow

### Code Exploration
```bash
# View project structure
tree -L 2 -I '__pycache__|*.pyc'

# Search for specific code
grep -r "def create_agent" .

# Find all TODOs
grep -r "TODO" . --include="*.py"
```

### Check Dependencies
```bash
# List installed packages
pip list

# Check for updates
pip list --outdated

# Freeze current versions
pip freeze > requirements_frozen.txt
```

## Visualization

### Generate Network Graphs
```bash
# Basic visualization
python visualize_graph.py

# Quick visualization
python quick_visualize.py
```

### View Generated Images
```bash
# List PNG files
ls -lh *.png

# Open specific visualization (macOS)
open drug_network.png
open drug_network_warfarin.png
```

## Debugging

### Enable Verbose Mode
```python
# In Python code
agent = create_agent(
    data_filepath="drug_interactions.graphml",
    verbose=True  # Enable detailed logging
)
```

### Check Environment Variables
```bash
# View all env vars
env | grep OPENAI

# Test .env loading
python -c "from dotenv import load_dotenv; import os; load_dotenv(); print('API Key:', 'SET' if os.getenv('OPENAI_API_KEY') else 'NOT SET')"
```

### Python Interactive Mode
```bash
# Start Python REPL with project context
python -i -c "from app.agents import create_agent; import os; os.environ['OPENAI_API_KEY'] = 'your-key'"
```

## Production Deployment

### Run API in Production Mode
```bash
# Set environment
export API_RELOAD=false

# Run with gunicorn (if installed)
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Or use uvicorn directly
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## No Automated Linting/Formatting
**Note**: There are no configured linters or formatters in this project. Consider adding:
- `black` for formatting
- `flake8` or `ruff` for linting
- `mypy` for type checking
- `isort` for import sorting
