"""
Drug Name Mapper Tool for LangGraph Agent

This tool integrates the drug name mapping functionality into the LangGraph agent system.
"""

from typing import List, Dict, Any
from langchain_core.tools import tool
import logging

logger = logging.getLogger(__name__)

# Import the drug mapper
try:
    from app.core.drug_mapper import get_drug_mapper, map_drug_name, map_multiple_drugs

    DRUG_MAPPER_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Drug mapper not available: {e}")
    DRUG_MAPPER_AVAILABLE = False


@tool
def map_extracted_drug_name(
    extracted_drug_name: str, threshold: float = 0.7
) -> Dict[str, Any]:
    """
    Map an extracted drug name to a standardized drug name using semantic similarity.

    Args:
        extracted_drug_name: The drug name extracted from text or image
        threshold: Minimum similarity threshold for matching (0.0 to 1.0)

    Returns:
        Dictionary containing the mapping result and metadata
    """
    if not DRUG_MAPPER_AVAILABLE:
        return {
            "success": False,
            "error": "Drug mapper not available. Please generate embeddings first.",
            "original_name": extracted_drug_name,
            "mapped_name": None,
            "similarity_score": 0.0,
        }

    try:
        # Map the drug name
        mapped_name = map_drug_name(extracted_drug_name, threshold)

        if mapped_name:
            # Get additional suggestions for context
            mapper = get_drug_mapper()
            suggestions = mapper.get_drug_suggestions(
                extracted_drug_name, top_k=3, threshold=0.5
            )

            return {
                "success": True,
                "original_name": extracted_drug_name,
                "mapped_name": mapped_name,
                "similarity_score": suggestions[0][1] if suggestions else 0.0,
                "alternative_suggestions": [
                    {"name": name, "score": score}
                    for name, score in suggestions[1:]  # Exclude the best match
                ],
                "confidence": (
                    "high"
                    if suggestions[0][1] > 0.8
                    else "medium" if suggestions[0][1] > 0.6 else "low"
                ),
            }
        else:
            return {
                "success": False,
                "error": f"No matching drug found for '{extracted_drug_name}' above threshold {threshold}",
                "original_name": extracted_drug_name,
                "mapped_name": None,
                "similarity_score": 0.0,
                "suggestions": [],
            }

    except Exception as e:
        logger.error(f"Error mapping drug name '{extracted_drug_name}': {e}")
        return {
            "success": False,
            "error": f"Error during mapping: {str(e)}",
            "original_name": extracted_drug_name,
            "mapped_name": None,
            "similarity_score": 0.0,
        }


@tool
def map_multiple_drug_names(
    extracted_drug_names: List[str], threshold: float = 0.7
) -> Dict[str, Any]:
    """
    Map multiple extracted drug names to standardized drug names.

    Args:
        extracted_drug_names: List of drug names extracted from text or image
        threshold: Minimum similarity threshold for matching (0.0 to 1.0)

    Returns:
        Dictionary containing mapping results for all drugs
    """
    if not DRUG_MAPPER_AVAILABLE:
        return {
            "success": False,
            "error": "Drug mapper not available. Please generate embeddings first.",
            "mappings": {},
        }

    try:
        # Map all drug names
        mappings = map_multiple_drugs(extracted_drug_names, threshold)

        # Get detailed results for each drug
        detailed_results = {}
        successful_mappings = 0

        for original_name in extracted_drug_names:
            mapped_name = mappings.get(original_name)

            if mapped_name:
                successful_mappings += 1
                # Get suggestions for context
                mapper = get_drug_mapper()
                suggestions = mapper.get_drug_suggestions(
                    original_name, top_k=2, threshold=0.5
                )

                detailed_results[original_name] = {
                    "mapped_name": mapped_name,
                    "similarity_score": suggestions[0][1] if suggestions else 0.0,
                    "confidence": (
                        "high"
                        if suggestions[0][1] > 0.8
                        else "medium" if suggestions[0][1] > 0.6 else "low"
                    ),
                    "alternative_suggestions": [
                        {"name": name, "score": score}
                        for name, score in suggestions[1:]
                    ],
                }
            else:
                detailed_results[original_name] = {
                    "mapped_name": None,
                    "similarity_score": 0.0,
                    "confidence": "none",
                    "alternative_suggestions": [],
                }

        return {
            "success": True,
            "total_drugs": len(extracted_drug_names),
            "successful_mappings": successful_mappings,
            "mappings": detailed_results,
        }

    except Exception as e:
        logger.error(f"Error mapping multiple drug names: {e}")
        return {
            "success": False,
            "error": f"Error during mapping: {str(e)}",
            "mappings": {},
        }


@tool
def get_drug_suggestions(
    extracted_drug_name: str, top_k: int = 5, threshold: float = 0.5
) -> Dict[str, Any]:
    """
    Get multiple drug name suggestions with similarity scores.

    Args:
        extracted_drug_name: The drug name to search for
        top_k: Number of suggestions to return
        threshold: Minimum similarity threshold

    Returns:
        Dictionary containing suggestions and scores
    """
    if not DRUG_MAPPER_AVAILABLE:
        return {
            "success": False,
            "error": "Drug mapper not available. Please generate embeddings first.",
            "suggestions": [],
        }

    try:
        mapper = get_drug_mapper()
        suggestions = mapper.get_drug_suggestions(extracted_drug_name, top_k, threshold)

        return {
            "success": True,
            "original_name": extracted_drug_name,
            "suggestions": [
                {"name": name, "score": score} for name, score in suggestions
            ],
            "total_suggestions": len(suggestions),
        }

    except Exception as e:
        logger.error(f"Error getting drug suggestions for '{extracted_drug_name}': {e}")
        return {
            "success": False,
            "error": f"Error getting suggestions: {str(e)}",
            "suggestions": [],
        }


@tool
def check_drug_availability(drug_name: str) -> Dict[str, Any]:
    """
    Check if a drug name is available in the database.

    Args:
        drug_name: The drug name to check

    Returns:
        Dictionary containing availability information
    """
    if not DRUG_MAPPER_AVAILABLE:
        return {
            "success": False,
            "error": "Drug mapper not available. Please generate embeddings first.",
            "available": False,
        }

    try:
        mapper = get_drug_mapper()
        is_available = mapper.is_drug_available(drug_name)

        return {
            "success": True,
            "drug_name": drug_name,
            "available": is_available,
            "total_drugs_in_database": (
                len(mapper.get_all_drug_names()) if is_available else 0
            ),
        }

    except Exception as e:
        logger.error(f"Error checking drug availability for '{drug_name}': {e}")
        return {
            "success": False,
            "error": f"Error checking availability: {str(e)}",
            "available": False,
        }


# List of available tools
DRUG_MAPPING_TOOLS = [
    map_extracted_drug_name,
    map_multiple_drug_names,
    get_drug_suggestions,
    check_drug_availability,
]
