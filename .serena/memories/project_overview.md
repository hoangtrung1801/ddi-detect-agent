# Drug Interaction Agent - Project Overview

## Purpose
AI-powered drug interaction search system that allows users to query drug-drug interactions using natural language. The system uses a graph data structure (igraph) to store drug interactions and a LangGraph-based AI agent powered by OpenAI GPT models to provide conversational access to the data.

## Key Features
- **Natural Language Queries**: Ask questions in plain English about drug interactions
- **Conversational Memory**: Maintains context across multiple queries in a session
- **Multiple Interfaces**: REST API, CLI, and programmatic Python API
- **Graph-based Search**: Efficient O(1) lookup for drug interactions using igraph
- **Streaming Support**: Real-time response streaming
- **Session Management**: Multiple concurrent conversations with separate contexts

## Technology Stack
- **Language**: Python 3.8+
- **Web Framework**: FastAPI (REST API)
- **AI Framework**: LangGraph + LangChain (agent orchestration)
- **LLM Provider**: OpenAI (GPT-3.5-turbo, GPT-4, GPT-4o-mini)
- **Graph Library**: python-igraph (efficient graph data structure)
- **Server**: Uvicorn (ASGI server)
- **Data Validation**: Pydantic v2
- **CLI Interface**: Rich (terminal formatting)
- **Visualization**: matplotlib, plotly, networkx
- **Environment**: python-dotenv

## Project Evolution
The project has undergone a migration from LangChain's agent framework to LangGraph, providing:
- More explicit control flow
- Better state management
- Improved debugging capabilities
- Streaming support
- Thread-based memory management

## Data Sources
- Primary dataset: `TWOSIDES_preprocessed.csv` (drug interaction data)
- Graph format: GraphML (drug_interactions.graphml)
- Can be loaded from CSV or JSON formats
