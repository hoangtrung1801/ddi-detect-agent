# Drug Interaction Agent - LangGraph Implementation

## 🎯 Overview

This directory contains the **LangGraph-based** implementation of the Drug Interaction Agent, migrated from the older LangChain agent architecture. LangGraph provides better control flow, explicit state management, and improved modularity.

## 📁 Structure

```
app/agents/
├── __init__.py                 # Package exports
├── drug_agent.py              # Main agent class
├── graph.py                   # LangGraph workflow definition
├── state.py                   # State definition for the graph
├── tools.py                   # Drug interaction tools
└── README.md                  # This file
```

## 🔄 Migration from LangChain to LangGraph

### Key Changes

| Aspect | LangChain (Old) | LangGraph (New) |
|--------|----------------|-----------------|
| **Agent Type** | `initialize_agent` + `AgentType` | Custom `StateGraph` |
| **Control Flow** | Implicit (framework-controlled) | Explicit (graph-based) |
| **State Management** | `ConversationBufferMemory` | `AgentState` TypedDict |
| **Memory** | Per-agent memory object | Thread-based checkpointer |
| **Tools** | `Tool` wrapper functions | `@tool` decorated functions |
| **Streaming** | Limited | Full support |
| **Debugging** | Difficult | Easy (explicit nodes) |

### Benefits of LangGraph

1. **Explicit Control Flow**: Clear graph structure showing how the agent works
2. **Better State Management**: TypedDict-based state with clear schema
3. **Improved Debugging**: Each node can be inspected individually
4. **Streaming Support**: Native streaming capabilities
5. **Thread-based Memory**: More flexible conversation management
6. **Modularity**: Easy to add new nodes or modify workflow

## 🏗️ Architecture

### Graph Workflow

```
┌─────────────────────────────────────────────────────────┐
│                     User Input                          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │  Agent Node    │
              │  (Reasoning)   │
              └────────┬───────┘
                       │
                ┌──────┴──────┐
                │             │
                ▼             ▼
         ┌──────────┐    ┌──────┐
         │  Tools   │    │ END  │
         │  Node    │    └──────┘
         └────┬─────┘
              │
              ▼
         (Loop back to Agent)
```

### Components

#### 1. **State (`state.py`)**

Defines the structure of data flowing through the graph:

```python
class AgentState(TypedDict):
    messages: Sequence[BaseMessage]  # Conversation history
    input: str                       # Current user input
    output: str                      # Agent's response
    intermediate_steps: list         # Debug information
```

#### 2. **Tools (`tools.py`)**

Three main tools for drug interaction queries:

- **`search_drug_interaction`**: Find interactions between two drugs
- **`get_all_drug_interactions`**: Get all interactions for one drug
- **`get_drug_statistics`**: Database statistics

#### 3. **Graph (`graph.py`)**

Defines the workflow:

- **Agent Node**: LLM reasoning with tool calls
- **Tools Node**: Executes selected tools
- **Conditional Edges**: Routes between nodes based on agent decisions

#### 4. **Agent (`drug_agent.py`)**

Main interface providing:

- `query()`: Synchronous query method
- `stream_query()`: Streaming response method
- `clear_memory()`: Reset conversation
- `get_graph_stats()`: Database statistics

## 🚀 Usage

### Basic Usage

```python
from app.agents import create_agent

# Create agent
agent = create_agent(
    data_filepath="drug_interactions.graphml",
    model_name="gpt-4o-mini",
    verbose=True
)

# Query
response = agent.query("What are the interactions between Warfarin and Aspirin?")
print(response)
```

### With Explicit Thread ID

```python
from app.agents import DrugInteractionAgent
from drug_interaction_graph import DrugInteractionGraph

# Load graph
graph = DrugInteractionGraph("drug_interactions.graphml")

# Create agent with specific thread
agent = DrugInteractionAgent(
    graph=graph,
    model_name="gpt-4o-mini",
    thread_id="user-123"  # Conversation will be saved under this ID
)

# Multiple queries will maintain context
agent.query("Tell me about Warfarin")
agent.query("What drugs interact with it?")  # "it" refers to Warfarin
```

### Streaming Responses

```python
# Stream the response
for chunk in agent.stream_query("Show me all interactions for Metformin"):
    print(chunk)
```

### Session Management

```python
# Each session has its own thread ID
agent1 = DrugInteractionAgent(graph=graph, thread_id="session-1")
agent2 = DrugInteractionAgent(graph=graph, thread_id="session-2")

# These maintain separate conversation histories
agent1.query("Tell me about Aspirin")
agent2.query("Tell me about Warfarin")
```

## 🔧 Configuration

### Model Selection

```python
# Use different OpenAI models
agent = create_agent(
    data_filepath="drug_interactions.graphml",
    model_name="gpt-4o-mini"      # Fast and cost-effective
    # model_name="gpt-4o"          # More capable
    # model_name="o3-mini"         # Reasoning model
)
```

### Memory Management

LangGraph uses a checkpointer-based memory system:

```python
# Memory is tied to thread_id
agent = DrugInteractionAgent(graph=graph, thread_id="user-123")

# To clear memory, generate a new thread ID
agent.clear_memory()  # Creates new thread ID internally
```

## 🔍 Debugging

### Verbose Mode

```python
agent = create_agent(
    data_filepath="drug_interactions.graphml",
    verbose=True  # Prints agent reasoning steps
)
```

### Inspecting State

```python
from app.agents.graph import DrugInteractionGraph as DrugAgentGraph

graph_workflow = DrugAgentGraph(graph=drug_graph, verbose=True)

# The graph workflow has access to intermediate states
```

## 🆚 Comparison with Old Implementation

### Old (LangChain)

```python
# drug_agent.py (old)
from langchain.agents import initialize_agent, AgentType
from langchain.memory import ConversationBufferMemory

agent = initialize_agent(
    agent=AgentType.CHAT_CONVERSATIONAL_REACT_DESCRIPTION,
    tools=tools,
    llm=llm,
    memory=ConversationBufferMemory(...)
)
```

**Limitations:**
- Black-box agent behavior
- Difficult to debug
- Limited customization
- Memory tied to agent instance

### New (LangGraph)

```python
# app/agents/graph.py (new)
from langgraph.graph import StateGraph

workflow = StateGraph(AgentState)
workflow.add_node("agent", self._agent_node)
workflow.add_node("tools", ToolNode(self.tools))
workflow.add_conditional_edges("agent", tools_condition, {...})
```

**Advantages:**
- Explicit graph structure
- Easy to understand and debug
- Highly customizable
- Thread-based memory management

## 📊 Performance

### Memory Usage

LangGraph uses a checkpointer system that's more memory-efficient for long conversations:

- **Old**: Stores entire conversation in memory
- **New**: Checkpoints to persistent storage (can use Redis, PostgreSQL, etc.)

### Speed

- Similar to LangChain for simple queries
- Better for complex workflows with multiple tool calls
- Streaming provides better perceived performance

## 🧪 Testing

Run the test suite:

```bash
python test_langgraph_agent.py
```

Expected output:
```
✓ Imports                  : PASSED
✓ State Definition         : PASSED
✓ Tools                    : PASSED
✓ Agent Creation           : PASSED
✓ API Integration          : PASSED
```

## 🔄 API Compatibility

The new agent maintains the same interface as the old one:

```python
# These methods work the same
agent.query(question)           # Query the agent
agent.clear_memory()            # Clear conversation
agent.get_graph_stats()         # Get database stats
```

**New method:**
```python
agent.stream_query(question)    # Stream responses (NEW!)
```

## 🚀 Future Enhancements

Possible improvements:

1. **Persistent Memory**: Use Redis/PostgreSQL for checkpointing
2. **Multi-Agent**: Add specialized agents for different tasks
3. **Human-in-the-Loop**: Add approval nodes for sensitive queries
4. **Parallel Tool Execution**: Execute multiple tools simultaneously
5. **Custom Routing**: Add more sophisticated routing logic

## 📚 Resources

- **LangGraph Docs**: https://python.langchain.com/docs/langgraph
- **LangGraph Tutorial**: https://langchain-ai.github.io/langgraph/
- **State Management**: https://langchain-ai.github.io/langgraph/concepts/low_level/

## 🎓 Learning Path

1. **Start here**: Read `state.py` to understand data flow
2. **Next**: Review `tools.py` to see tool definitions
3. **Then**: Study `graph.py` to understand the workflow
4. **Finally**: Check `drug_agent.py` for the public interface

## 🐛 Troubleshooting

### Import Errors

```python
# Make sure you're importing from app.agents
from app.agents import create_agent  # ✓ Correct
from drug_agent import create_agent  # ✗ Old import
```

### Memory Not Working

```python
# Make sure to use consistent thread_id
agent = DrugInteractionAgent(graph=graph, thread_id="user-123")
```

### Tool Not Executing

Check that tools are properly bound to LLM:
```python
self.llm_with_tools = self.llm.bind_tools(self.tools)
```

## ✅ Checklist for Custom Modifications

When modifying the agent:

- [ ] Update `AgentState` if adding new state fields
- [ ] Add new tools in `tools.py` using `@tool` decorator
- [ ] Update graph workflow in `graph.py` if adding nodes
- [ ] Update `drug_agent.py` interface if adding public methods
- [ ] Add tests in `test_langgraph_agent.py`
- [ ] Update this README

## 🎉 Summary

The migration to LangGraph provides:

✅ **Better Architecture**: Explicit, understandable workflow
✅ **Improved Debugging**: Clear visibility into agent decisions
✅ **More Features**: Streaming, better memory management
✅ **Future-Ready**: Easy to extend and customize
✅ **Same Interface**: Compatible with existing API

The agent is production-ready and provides a solid foundation for future enhancements!
