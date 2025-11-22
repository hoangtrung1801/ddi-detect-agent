# LLM-Based Drug Name Conversion and Mapping System

## Overview

This system provides intelligent drug name conversion using a two-step process:

1. **LLM Conversion**: Uses AI to convert drug names (brand/trade names) to their active ingredients
2. **Database Mapping**: Maps the extracted ingredients to standardized names in the database

This approach handles brand names (e.g., "Tylenol", "Advil", "Coumadin") and converts them to their generic active ingredients (e.g., "Acetaminophen", "Ibuprofen", "Warfarin") before checking interactions.

## How It Works

### Step 1: LLM-Based Active Ingredient Extraction

The system uses a pharmaceutical expert LLM to:
- Identify the primary active ingredient from a brand or generic name
- Recognize trade names and convert them to generic names
- Handle international non-proprietary names (INN)
- Provide reasoning for the conversion

**Example:**
```
Input: "Tylenol"
LLM Output:
  - Active Ingredient: "Acetaminophen"
  - Reasoning: "Tylenol is a brand name for Acetaminophen"
  - Confidence: High
```

### Step 2: Database Mapping

After LLM extraction, the system:
- Uses embedding-based similarity search to find the closest match in the database
- Handles spelling variations and synonyms
- Returns the standardized name used in the interaction database

**Example:**
```
LLM Output: "Acetaminophen"
Database Mapping: "acetaminophen" (lowercase, standardized)
```

## Architecture

### Components

1. **EnhancedDrugInteractionTools** (`app/agents/enhanced_tools.py`)
   - Contains the LLM-based conversion logic
   - Integrates with the drug interaction database
   - Provides tools for the LangGraph agent

2. **ActiveIngredientResponse** (Pydantic Model)
   ```python
   class ActiveIngredientResponse(BaseModel):
       reasoning: str
       active_ingredient: str
       confidence: str  # "high", "medium", or "low"
   ```

3. **DrugInteractionGraph** (`app/agents/graph.py`)
   - LangGraph workflow that orchestrates the tools
   - Handles multi-drug interaction checking
   - Provides conversational interface

### Key Methods

#### `_extract_active_ingredient(drug_name: str) -> tuple[str, str]`

Uses LLM to extract the active ingredient from a drug name.

```python
active_ingredient, reasoning = self._extract_active_ingredient("Tylenol")
# Returns: ("Acetaminophen", "Tylenol is a brand name for Acetaminophen")
```

#### `_map_drug_name(drug_name: str) -> str`

Complete two-step conversion process:

```python
final_name = self._map_drug_name("Tylenol")
# Step 1: LLM converts "Tylenol" -> "Acetaminophen"
# Step 2: Database maps "Acetaminophen" -> "acetaminophen"
# Returns: "acetaminophen"
```

## Available Tools

### 1. `search_drug_interaction(query: str) -> str`

**Automatic Conversion**: Drug names are automatically converted before checking interactions.

```python
# Example: "Tylenol and Coumadin"
# Converts: "Tylenol" -> "Acetaminophen" -> "acetaminophen"
#          "Coumadin" -> "Warfarin" -> "warfarin"
# Checks: interaction between "acetaminophen" and "warfarin"
```

**Response includes conversion details:**
```
Drug Conversions:
• Converted 'Tylenol' → 'acetaminophen'
• Converted 'Coumadin' → 'warfarin'

Interaction between Acetaminophen and Warfarin: [interaction details]
```

### 2. `map_drug_name_tool(drug_name: str) -> str`

**Explicit Mapping**: Shows detailed conversion process.

```python
# Example: "Tylenol"
# Returns:
# ✓ LLM Conversion: 'Tylenol' → 'Acetaminophen'
#   Reasoning: Tylenol is a brand name for Acetaminophen
# ✓ Database Mapping: 'Acetaminophen' → 'acetaminophen'
#
# ✓ Final Name: 'acetaminophen'
```

## Usage Examples

### Basic Usage

```python
from drug_interaction_graph import DrugInteractionGraph
from app.agents.graph import DrugInteractionGraph as LangGraphAgent

# Initialize
graph = DrugInteractionGraph()
graph.load_from_csv("TWOSIDES_preprocessed.csv")

# Create agent with LLM mapping enabled
agent = LangGraphAgent(
    graph=graph,
    model_name="gpt-4o-mini",
    enable_drug_mapping=True  # Enable LLM-based mapping
)

# Query with brand names
response = agent.invoke("Check interactions between Tylenol and Advil")
# System automatically converts:
#   Tylenol -> Acetaminophen
#   Advil -> Ibuprofen
# Then checks interaction between acetaminophen and ibuprofen
```

### Multiple Drugs

```python
# Check interactions between multiple drugs (brand and generic names)
response = agent.invoke(
    "What are the interactions between Coumadin, Aspirin, and Motrin?"
)

# System converts:
#   Coumadin -> Warfarin
#   Aspirin -> Aspirin (already generic)
#   Motrin -> Ibuprofen

# Then checks all unique pairs:
#   1. Warfarin + Aspirin
#   2. Warfarin + Ibuprofen
#   3. Aspirin + Ibuprofen
```

### Explicit Mapping Check

```python
# Explicitly check drug name mapping
response = agent.invoke("What is the active ingredient in Tylenol?")
# Agent uses map_drug_name_tool to show conversion process
```

## Agent Workflow

The agent follows this workflow when checking drug interactions:

```
User Query: "Check Tylenol and Coumadin"
    ↓
1. [Optional] Agent uses map_drug_name_tool
   - Shows explicit conversion for user transparency
    ↓
2. Agent uses search_drug_interaction
   - LLM converts: "Tylenol" -> "Acetaminophen"
   - Database maps: "Acetaminophen" -> "acetaminophen"
   - LLM converts: "Coumadin" -> "Warfarin"
   - Database maps: "Warfarin" -> "warfarin"
   - Searches interaction database
    ↓
3. Agent analyzes results
   - Evaluates severity
   - Provides recommendations
    ↓
4. Agent provides formatted response
   - Drug conversions
   - Interaction details
   - Clinical recommendations
```

## Benefits

### 1. **Brand Name Recognition**
- Handles common brand names automatically
- No need for users to know generic names

### 2. **Intelligent Conversion**
- Uses pharmaceutical knowledge from LLM
- Understands context and drug classifications

### 3. **Robust Mapping**
- Combines LLM intelligence with database search
- Handles spelling variations and synonyms

### 4. **Transparent Process**
- Shows conversion steps to users
- Provides reasoning for conversions

### 5. **Flexible Input**
- Accepts brand names, generic names, or mixture
- Normalizes all inputs to database standard

## Configuration

### Enable/Disable LLM Mapping

```python
# Enable (default)
agent = LangGraphAgent(
    graph=graph,
    enable_drug_mapping=True
)

# Disable (use only exact database names)
agent = LangGraphAgent(
    graph=graph,
    enable_drug_mapping=False
)
```

### LLM Model Selection

```python
# Use different model for ingredient extraction
agent = LangGraphAgent(
    graph=graph,
    model_name="gpt-4o",  # More powerful model
    enable_drug_mapping=True
)
```

## Testing

Run the test script to see the system in action:

```bash
python test_llm_drug_mapping.py
```

Test cases include:
- Brand name conversions (Tylenol, Advil, Coumadin)
- Multiple drug interactions
- Mixed brand/generic names
- Explicit mapping checks

## Performance Considerations

### LLM Calls

Each unique drug name requires:
1. One LLM call for active ingredient extraction
2. One database query for mapping

**Optimization**: Results could be cached for repeated drug names.

### Latency

- LLM extraction: ~500-1000ms per drug
- Database mapping: ~10-50ms per drug

For 3 drugs:
- Total conversion time: ~1.5-3 seconds
- Plus interaction checks: ~100ms

## Future Enhancements

1. **Caching**: Cache LLM conversion results
2. **Batch Processing**: Process multiple drugs in one LLM call
3. **Confidence Thresholds**: Warn on low-confidence conversions
4. **Multi-ingredient Support**: Handle combination drugs
5. **Alternative Suggestions**: Provide multiple matches when uncertain

## Error Handling

The system gracefully handles errors:

```python
# Unknown drug name
Input: "XYZ123"
LLM: Returns "XYZ123" (unchanged) with low confidence
Database: No match found
Result: "No interaction found for XYZ123"

# LLM error
Input: "Tylenol"
LLM: Exception occurs
Fallback: Uses original name "Tylenol"
Database: Attempts mapping with original name
```

## See Also

- `app/agents/enhanced_tools.py` - Implementation
- `app/agents/graph.py` - Agent workflow
- `app/core/drug_mapper.py` - Database mapping
- `test_llm_drug_mapping.py` - Test examples
