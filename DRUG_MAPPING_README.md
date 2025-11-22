# Drug Name Mapping System

This system provides semantic drug name mapping using embeddings to match extracted drug names to standardized drug names in the database.

## Overview

The drug mapping system uses sentence transformers to create embeddings for drug names, enabling semantic similarity search. This allows the DDI agent to:

1. **Map extracted drug names** to standardized names from the database
2. **Handle variations** in drug names (brand names, generic names, misspellings)
3. **Provide confidence scores** for mapping accuracy
4. **Suggest alternatives** when exact matches aren't found

## Files Created

### Core Files
- `drug_embedding_generator.py` - Main script to generate embeddings
- `app/core/drug_mapper.py` - Core mapping functionality
- `app/agents/drug_name_mapper_tool.py` - LangGraph agent tools
- `generate_drug_embeddings.py` - Script to run embedding generation
- `test_drug_mapping.py` - Test script for the mapping system

### Generated Files (after running embedding generation)
- `drug_embeddings_embeddings.npy` - Numpy array of drug name embeddings
- `drug_embeddings_mapping.json` - JSON mapping data
- `drug_embeddings_mapper.pkl` - Pickled mapper for fast loading

## Setup Instructions

### 1. Install Dependencies

```bash
pip install sentence-transformers scikit-learn
```

Or install from requirements.txt:
```bash
pip install -r requirements.txt
```

### 2. Generate Embeddings

Run the embedding generation script:

```bash
python3 generate_drug_embeddings.py
```

This will:
- Load drug names from `unique_drugs.txt`
- Generate embeddings using sentence transformers
- Save the embeddings and mapping data
- Test the system with sample queries

### 3. Test the System

```bash
python3 test_drug_mapping.py
```

## Usage Examples

### Basic Usage

```python
from app.core.drug_mapper import map_drug_name, map_multiple_drugs

# Map a single drug name
mapped_name = map_drug_name("tylenol", threshold=0.7)
print(f"tylenol -> {mapped_name}")  # Should map to "Acetaminophen"

# Map multiple drug names
drugs = ["aspirin", "warfarin", "ibuprofen"]
results = map_multiple_drugs(drugs, threshold=0.7)
print(results)
```

### Advanced Usage

```python
from app.core.drug_mapper import get_drug_mapper

# Get the mapper instance
mapper = get_drug_mapper()

# Get drug suggestions with scores
suggestions = mapper.get_drug_suggestions("tylenol", top_k=5, threshold=0.5)
for name, score in suggestions:
    print(f"{name}: {score:.3f}")

# Check if a drug is available
is_available = mapper.is_drug_available("aspirin")
print(f"Aspirin available: {is_available}")
```

### Using with LangGraph Agent

```python
from app.agents.drug_name_mapper_tool import map_extracted_drug_name

# Use as a tool in your agent
result = map_extracted_drug_name("tylenol", threshold=0.7)
print(result)
```

## Configuration

### Similarity Thresholds

- **0.9+**: Very high confidence (exact or near-exact match)
- **0.8-0.9**: High confidence (very similar)
- **0.7-0.8**: Medium confidence (similar)
- **0.6-0.7**: Low confidence (somewhat similar)
- **<0.6**: Very low confidence (may not be a good match)

### Model Configuration

The system uses `all-MiniLM-L6-v2` by default, which provides a good balance of:
- Accuracy
- Speed
- Memory usage

To use a different model, modify the `model_name` parameter in `DrugEmbeddingMapper`.

## Integration with DDI Agent

### 1. Add Tools to Agent

```python
from app.agents.drug_name_mapper_tool import DRUG_MAPPING_TOOLS

# Add to your agent's tools
agent_tools = existing_tools + DRUG_MAPPING_TOOLS
```

### 2. Use in Agent Workflow

```python
# In your agent's workflow
def process_drug_names(extracted_names):
    # Map extracted names to standardized names
    mapping_result = map_multiple_drug_names(extracted_names, threshold=0.7)

    if mapping_result["success"]:
        # Use mapped names for drug interaction checking
        mapped_drugs = [
            mapping["mapped_name"]
            for mapping in mapping_result["mappings"].values()
            if mapping["mapped_name"]
        ]
        return mapped_drugs
    else:
        # Handle mapping failure
        return []
```

## Performance Considerations

### Memory Usage
- Embeddings: ~2MB for 1700+ drugs
- Model loading: ~50MB
- Total memory: ~60MB

### Speed
- Single mapping: ~10-50ms
- Multiple mappings: ~50-200ms
- Model loading: ~2-5 seconds (first time only)

### Optimization Tips
1. **Reuse mapper instance** - Don't reload for each request
2. **Batch mappings** - Use `map_multiple_drugs` for multiple drugs
3. **Adjust thresholds** - Higher thresholds = faster but less flexible
4. **Cache results** - Cache frequently used mappings

## Troubleshooting

### Common Issues

1. **"Drug mapper not available"**
   - Run `python3 generate_drug_embeddings.py` first
   - Check that embedding files exist

2. **"No matching drug found"**
   - Lower the threshold (try 0.5-0.6)
   - Check for typos in the input
   - Use `get_drug_suggestions` to see alternatives

3. **Import errors**
   - Install dependencies: `pip install sentence-transformers scikit-learn`
   - Check Python path includes the app directory

4. **Memory issues**
   - The system uses ~60MB total
   - Consider using a smaller model if needed

### Debug Mode

Enable debug logging to see detailed information:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## API Reference

### Core Functions

#### `map_drug_name(extracted_name, threshold=0.7)`
Maps a single drug name to standardized name.

**Parameters:**
- `extracted_name` (str): Drug name to map
- `threshold` (float): Minimum similarity threshold

**Returns:**
- `str` or `None`: Mapped drug name

#### `map_multiple_drugs(extracted_names, threshold=0.7)`
Maps multiple drug names.

**Parameters:**
- `extracted_names` (List[str]): List of drug names
- `threshold` (float): Minimum similarity threshold

**Returns:**
- `Dict[str, str]`: Mapping from original to mapped names

#### `get_drug_suggestions(extracted_name, top_k=5, threshold=0.5)`
Gets multiple drug suggestions with scores.

**Parameters:**
- `extracted_name` (str): Drug name to search
- `top_k` (int): Number of suggestions
- `threshold` (float): Minimum similarity threshold

**Returns:**
- `List[Tuple[str, float]]`: List of (name, score) tuples

### LangGraph Tools

#### `map_extracted_drug_name`
LangGraph tool for single drug mapping.

#### `map_multiple_drug_names`
LangGraph tool for multiple drug mapping.

#### `get_drug_suggestions`
LangGraph tool for getting drug suggestions.

#### `check_drug_availability`
LangGraph tool for checking drug availability.

## Future Enhancements

1. **Fuzzy matching** - Add fuzzy string matching as fallback
2. **Custom models** - Train domain-specific models
3. **Caching** - Add Redis/memory caching for frequent mappings
4. **Batch processing** - Optimize for large batches
5. **Metrics** - Add mapping accuracy metrics and monitoring
