# Quick Start Guide - Drug Interaction Agent

Get up and running with the AI-powered drug interaction agent in 5 minutes!

## Prerequisites

- Python 3.8 or higher
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## Installation

### Step 1: Clone/Download the Repository

If you haven't already, get the code on your machine.

### Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

**Note**: If you have issues with `python-igraph`, see the main README for platform-specific installation instructions.

### Step 3: Configure OpenAI API Key

Create a `.env` file in the project directory:

```bash
OPENAI_API_KEY=sk-your_actual_api_key_here
```

Or set it as an environment variable:

```bash
export OPENAI_API_KEY="sk-your_actual_api_key_here"
```

See `ENV_SETUP.md` for more configuration options.

### Step 4: Verify Installation

Run the test script to ensure everything is set up correctly:

```bash
python test_agent.py
```

If all tests pass ✅, you're ready to go!

## Usage Options

### Option 1: Command-Line Interface (CLI)

Perfect for interactive queries and testing.

```bash
python drug_agent_cli.py
```

**Example session**:
```
You: What happens if I take Warfarin and Aspirin together?
Agent: [Provides detailed interaction information]

You: Show me all interactions for Metformin
Agent: [Lists all Metformin interactions]

You: /stats
[Shows database statistics]

You: /exit
```

### Option 2: REST API

Ideal for integrating with other applications.

**Start the server**:
```bash
python drug_agent_api.py
```

The API will be available at `http://localhost:8000`

**Interactive API docs**: Visit `http://localhost:8000/docs` in your browser

**Quick test with curl**:
```bash
curl -X POST "http://localhost:8000/query" \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the interactions between Warfarin and Aspirin?"}'
```

### Option 3: Python Code

Use the agent directly in your Python scripts.

```python
from drug_agent import create_agent

# Create agent
agent = create_agent(
    data_filepath="TWOSIDES_preprocessed.csv",
    model_name="gpt-3.5-turbo"
)

# Ask questions
response = agent.query("What happens if I take Warfarin and Aspirin?")
print(response)

# Get all interactions for a drug
response = agent.query("Show me all interactions for Metformin")
print(response)
```

## Example Questions

Try these example questions with the agent:

**Specific Interactions**:
- "What happens if I take Warfarin and Aspirin together?"
- "Can I combine Ibuprofen with Alcohol?"
- "Is there an interaction between Metformin and Insulin?"

**All Interactions for a Drug**:
- "Show me all interactions for Warfarin"
- "What drugs interact with Metformin?"
- "List all interactions for Aspirin"

**Follow-up Questions** (uses conversation memory):
- "What about Ibuprofen?" (after asking about another drug)
- "Is that dangerous?"
- "Are there alternatives?"

## Tips

1. **Model Selection**: `gpt-3.5-turbo` is faster and cheaper for most queries. Use `gpt-4` for more complex questions.

2. **Conversation Memory**:
   - CLI: Use `/clear` to reset conversation history
   - API: Use the `/chat` endpoint with session management
   - Code: Call `agent.clear_memory()`

3. **Cost Optimization**: Each query costs a few cents. The stateless `/query` endpoint is slightly cheaper than session-based chat.

4. **Data Source**: The default dataset is `TWOSIDES_preprocessed.csv`. You can use your own drug interaction data in the same CSV format.

## Troubleshooting

### "OpenAI API key not found"
- Ensure you've created a `.env` file with your API key
- Or export it: `export OPENAI_API_KEY="sk-..."`

### "Data file not found"
- Make sure `TWOSIDES_preprocessed.csv` exists in the project directory
- Or specify a different file with `DATA_FILE` env variable

### "Package not found" or Import Errors
- Run: `pip install -r requirements.txt`
- For `igraph` issues, see the main README

### Agent gives generic responses
- The drug might not be in the database
- Try different spelling or generic drug names
- Check database stats with `/stats` command (CLI) or `/stats` endpoint (API)

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [ENV_SETUP.md](ENV_SETUP.md) for advanced configuration
- Explore the API at `http://localhost:8000/docs`
- Customize the agent in `drug_agent.py`

## Need Help?

- Check the main README.md for detailed documentation
- Review ENV_SETUP.md for configuration options
- Run `python test_agent.py` to diagnose issues

## Resources

- OpenAI API Documentation: https://platform.openai.com/docs
- LangChain Documentation: https://python.langchain.com/
- FastAPI Documentation: https://fastapi.tiangolo.com/

Happy querying! 🚀💊
