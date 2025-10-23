#!/usr/bin/env python3
"""
Generate Drug Embeddings Script

This script generates embeddings for drug names and creates the mapping system.
Run this script to create the necessary embedding files for drug name matching.
"""

import sys
import os
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent / "app"))

from drug_embedding_generator import DrugEmbeddingMapper
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def main():
    """Generate drug embeddings and test the system."""

    # File paths
    drug_file = "unique_drugs.txt"
    output_base = "drug_embeddings"

    # Check if drug file exists
    if not Path(drug_file).exists():
        logger.error(f"Drug file not found: {drug_file}")
        logger.error("Please ensure unique_drugs.txt is in the current directory")
        return False

    logger.info("Starting drug embedding generation...")

    try:
        # Initialize mapper
        mapper = DrugEmbeddingMapper()

        # Load drug names
        logger.info("Loading drug names...")
        drug_names = mapper.load_drug_names(drug_file)

        if not drug_names:
            logger.error("No drug names found in the file")
            return False

        # Generate embeddings
        logger.info("Generating embeddings...")
        embeddings = mapper.generate_embeddings(drug_names)

        # Build mapping
        logger.info("Building mapping...")
        mapper.build_mapping(drug_names, embeddings)

        # Save embeddings
        logger.info("Saving embeddings...")
        mapper.save_embeddings(output_base)

        # Test the mapper
        logger.info("\n" + "=" * 50)
        logger.info("TESTING THE DRUG MAPPER")
        logger.info("=" * 50)

        test_queries = [
            "aspirin",
            "warfarin",
            "ibuprofen",
            "acetaminophen",
            "metformin",
            "lisinopril",
            "simvastatin",
            "omeprazole",
            "amlodipine",
            "metoprolol",
        ]

        for query in test_queries:
            logger.info(f"\nQuery: '{query}'")
            results = mapper.find_closest_drug(query, top_k=3, threshold=0.5)
            if results:
                for i, (drug_name, score) in enumerate(results, 1):
                    logger.info(f"  {i}. {drug_name} (similarity: {score:.3f})")
            else:
                logger.info("  No matches found above threshold")

        # Test the drug mapper utility
        logger.info("\n" + "=" * 50)
        logger.info("TESTING DRUG MAPPER UTILITY")
        logger.info("=" * 50)

        from app.core.drug_mapper import (
            get_drug_mapper,
            map_drug_name,
            map_multiple_drugs,
        )

        # Load the mapper
        drug_mapper = get_drug_mapper(output_base)
        if drug_mapper:
            logger.info("Successfully loaded drug mapper utility")

            # Test single drug mapping
            test_drugs = ["aspirin", "warfarin", "ibuprofen", "tylenol", "advil"]
            logger.info("\nSingle drug mapping tests:")
            for drug in test_drugs:
                mapped = map_drug_name(drug, threshold=0.6)
                logger.info(f"  '{drug}' -> '{mapped}'")

            # Test multiple drug mapping
            logger.info("\nMultiple drug mapping test:")
            multiple_results = map_multiple_drugs(test_drugs, threshold=0.6)
            for original, mapped in multiple_results.items():
                logger.info(f"  '{original}' -> '{mapped}'")

        logger.info("\n" + "=" * 50)
        logger.info("DRUG EMBEDDING GENERATION COMPLETED SUCCESSFULLY!")
        logger.info("=" * 50)
        logger.info(f"Embedding files created:")
        logger.info(f"  - {output_base}_embeddings.npy")
        logger.info(f"  - {output_base}_mapping.json")
        logger.info(f"  - {output_base}_mapper.pkl")
        logger.info("\nYou can now use the drug mapper in your DDI agent!")

        return True

    except Exception as e:
        logger.error(f"Error during embedding generation: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
