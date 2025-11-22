# Environment Setup Guide

This guide explains how to configure environment variables for the Drug Interaction Agent.

## Required Environment Variables

### OPENAI_API_KEY (Required)

Your OpenAI API key is required to run the agent.

**Get your API key**: https://platform.openai.com/api-keys

## Optional Environment Variables

### OPENAI_MODEL
- **Default**: `gpt-3.5-turbo`
- **Options**: `gpt-3.5-turbo`, `gpt-4`, `gpt-4-turbo`
- **Description**: The OpenAI model to use for the agent

### DATA_FILE
- **Default**: `TWOSIDES_preprocessed.csv`
- **Description**: Path to the drug interaction data file

### API_HOST
- **Default**: `0.0.0.0`
- **Description**: Host address for the REST API server

### API_PORT
- **Default**: `8000`
- **Description**: Port number for the REST API server

### API_RELOAD
- **Default**: `true`
- **Description**: Whether to auto-reload the API on code changes (development mode)

## Setup Methods

### Method 1: Create a .env file (Recommended)

Create a file named `.env` in the project root with the following content:

```bash
# Required
OPENAI_API_KEY=sk-your_api_key_here

# Optional (with defaults)
OPENAI_MODEL=gpt-3.5-turbo
DATA_FILE=TWOSIDES_preprocessed.csv
API_HOST=0.0.0.0
API_PORT=8000
API_RELOAD=true
```

**Note**: Never commit your `.env` file to version control. Add it to `.gitignore`.

### Method 2: Export Environment Variables

Export variables in your shell session:

```bash
export OPENAI_API_KEY="sk-your_api_key_here"
export OPENAI_MODEL="gpt-3.5-turbo"
export DATA_FILE="TWOSIDES_preprocessed.csv"
```

### Method 3: Pass to Python Directly

```python
import os
os.environ['OPENAI_API_KEY'] = 'sk-your_api_key_here'

from drug_agent import create_agent
agent = create_agent(
    data_filepath="TWOSIDES_preprocessed.csv",
    openai_api_key="sk-your_api_key_here",  # Can also pass directly
    model_name="gpt-3.5-turbo"
)
```

## Verification

Test your setup:

```bash
# Test that the API key is set
python -c "import os; from dotenv import load_dotenv; load_dotenv(); print('API Key:', 'SET' if os.getenv('OPENAI_API_KEY') else 'NOT SET')"
```

## Troubleshooting

### "OpenAI API key not found" Error

**Solution**: Ensure you've set the `OPENAI_API_KEY` environment variable using one of the methods above.

### "Data file not found" Error

**Solution**:
- Make sure `TWOSIDES_preprocessed.csv` exists in the project directory
- Or set `DATA_FILE` to the correct path to your data file

### API Key Format

- OpenAI API keys start with `sk-`
- Example: `sk-proj-abc123...`
- Keep your API key secure and never share it publicly

## Model Costs (as of 2024)

- **gpt-3.5-turbo**: $0.0015 per 1K input tokens, $0.002 per 1K output tokens
- **gpt-4**: $0.03 per 1K input tokens, $0.06 per 1K output tokens
- **gpt-4-turbo**: $0.01 per 1K input tokens, $0.03 per 1K output tokens

For most drug interaction queries, `gpt-3.5-turbo` is sufficient and cost-effective.
