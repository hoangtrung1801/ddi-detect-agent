#!/usr/bin/env python3
"""
Drug Name Embedding Generator

This script generates embeddings for drug names from unique_drugs.txt
and creates a mapping system for drug name matching in the DDI agent.
"""

import json
import pickle
import numpy as np
from pathlib import Path
from typing import List, Tuple
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DrugEmbeddingMapper:
    """Handles drug name embeddings and similarity matching."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize the drug embedding mapper.

        Args:
            model_name: Name of the sentence transformer model to use
        """
        self.model_name = model_name
        self.model = None
        self.drug_names = []
        self.embeddings = None
        self.drug_to_index = {}

    def load_drug_names(self, file_path: str) -> List[str]:
        """
        Load drug names from the unique_drugs.txt file.

        Args:
            file_path: Path to the unique_drugs.txt file

        Returns:
            List of drug names
        """
        drug_names = []
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    # Remove line numbers if present (format: "123|Drug Name")
                    if "|" in line:
                        drug_name = line.split("|", 1)[1].strip()
                    else:
                        drug_name = line.strip()
                    if drug_name:
                        drug_names.append(drug_name)

        logger.info(f"Loaded {len(drug_names)} drug names")
        return drug_names

    def generate_embeddings(self, drug_names: List[str]) -> np.ndarray:
        """
        Generate embeddings for drug names using sentence transformers.

        Args:
            drug_names: List of drug names

        Returns:
            Numpy array of embeddings
        """
        if self.model is None:
            logger.info(f"Loading sentence transformer model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)

        logger.info("Generating embeddings for drug names...")
        embeddings = self.model.encode(drug_names, show_progress_bar=True)
        logger.info(f"Generated embeddings with shape: {embeddings.shape}")

        return embeddings

    def build_mapping(self, drug_names: List[str], embeddings: np.ndarray):
        """
        Build the drug name to index mapping.

        Args:
            drug_names: List of drug names
            embeddings: Numpy array of embeddings
        """
        self.drug_names = drug_names
        self.embeddings = embeddings
        self.drug_to_index = {name: idx for idx, name in enumerate(drug_names)}

        logger.info(f"Built mapping for {len(drug_names)} drugs")

    def find_closest_drug(
        self, query_drug: str, top_k: int = 5, threshold: float = 0.7
    ) -> List[Tuple[str, float]]:
        """
        Find the closest matching drug name(s) for a query.

        Args:
            query_drug: The drug name to search for
            top_k: Number of top matches to return
            threshold: Minimum similarity threshold

        Returns:
            List of tuples (drug_name, similarity_score)
        """
        if self.model is None or self.embeddings is None:
            raise ValueError("Model not initialized. Call generate_embeddings first.")

        # Generate embedding for the query
        query_embedding = self.model.encode([query_drug])

        # Calculate cosine similarities
        similarities = cosine_similarity(query_embedding, self.embeddings)[0]

        # Get top-k indices
        top_indices = np.argsort(similarities)[::-1][:top_k]

        # Filter by threshold and return results
        results = []
        for idx in top_indices:
            similarity = similarities[idx]
            if similarity >= threshold:
                results.append((self.drug_names[idx], float(similarity)))

        return results

    def save_embeddings(self, file_path: str):
        """
        Save the embeddings and mapping to files.

        Args:
            file_path: Base path for saving files (without extension)
        """
        if self.embeddings is None:
            raise ValueError("No embeddings to save. Generate embeddings first.")

        # Save embeddings as numpy array
        embeddings_path = f"{file_path}_embeddings.npy"
        np.save(embeddings_path, self.embeddings)

        # Save drug names and mapping as JSON
        mapping_data = {
            "drug_names": self.drug_names,
            "drug_to_index": self.drug_to_index,
            "model_name": self.model_name,
            "embedding_shape": self.embeddings.shape,
        }

        mapping_path = f"{file_path}_mapping.json"
        with open(mapping_path, "w", encoding="utf-8") as f:
            json.dump(mapping_data, f, indent=2, ensure_ascii=False)

        # Save as pickle for faster loading
        pickle_path = f"{file_path}_mapper.pkl"
        with open(pickle_path, "wb") as f:
            pickle.dump(self, f)

        logger.info(f"Saved embeddings to {embeddings_path}")
        logger.info(f"Saved mapping to {mapping_path}")
        logger.info(f"Saved mapper to {pickle_path}")

    @classmethod
    def load_mapper(cls, file_path: str) -> "DrugEmbeddingMapper":
        """
        Load a saved mapper from file.

        Args:
            file_path: Base path for loading files (without extension)

        Returns:
            Loaded DrugEmbeddingMapper instance
        """
        pickle_path = f"{file_path}_mapper.pkl"

        try:
            with open(pickle_path, "rb") as f:
                mapper = pickle.load(f)
            logger.info(f"Loaded mapper from {pickle_path}")
            return mapper
        except FileNotFoundError:
            logger.warning(f"Pickle file not found: {pickle_path}")
            return None


def main():
    """Main function to generate drug embeddings."""
    # File paths
    drug_file = "unique_drugs.txt"
    output_base = "drug_embeddings"

    # Check if drug file exists
    if not Path(drug_file).exists():
        logger.error(f"Drug file not found: {drug_file}")
        return

    # Initialize mapper
    mapper = DrugEmbeddingMapper()

    # Load drug names
    drug_names = mapper.load_drug_names(drug_file)

    # Generate embeddings
    embeddings = mapper.generate_embeddings(drug_names)

    # Build mapping
    mapper.build_mapping(drug_names, embeddings)

    # Save embeddings
    mapper.save_embeddings(output_base)

    # Test the mapper
    logger.info("\nTesting the mapper with sample queries:")
    test_queries = [
        "aspirin",
        "warfarin",
        "ibuprofen",
        "acetaminophen",
        "metformin",
        "lisinopril",
    ]

    for query in test_queries:
        results = mapper.find_closest_drug(query, top_k=3)
        logger.info(f"Query: '{query}' -> {results}")


if __name__ == "__main__":
    main()
