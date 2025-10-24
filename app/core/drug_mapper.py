"""
Drug Name Mapping Utility

This module provides functionality to map extracted drug names to standardized
drug names using semantic similarity via embeddings.
"""

import json
import pickle
import numpy as np
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import logging

logger = logging.getLogger(__name__)


class DrugNameMapper:
    """
    Maps extracted drug names to standardized drug names using semantic similarity.
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize the drug name mapper.

        Args:
            model_name: Name of the sentence transformer model to use
        """
        self.model_name = model_name
        self.model = None
        self.drug_names = []
        self.embeddings = None
        self.drug_to_index = {}
        self.is_loaded = False

    def load_embeddings(self, embeddings_path: str) -> bool:
        """
        Load pre-computed embeddings and mappings.

        Args:
            embeddings_path: Base path for the embedding files (without extension)

        Returns:
            True if loaded successfully, False otherwise
        """
        try:
            # Try loading from pickle first (fastest)
            pickle_path = f"{embeddings_path}_mapper.pkl"
            if Path(pickle_path).exists():
                with open(pickle_path, "rb") as f:
                    saved_mapper = pickle.load(f)
                    self.model = saved_mapper.model
                    self.drug_names = saved_mapper.drug_names
                    self.embeddings = saved_mapper.embeddings
                    self.drug_to_index = saved_mapper.drug_to_index
                    self.is_loaded = True
                    logger.info(f"Loaded drug mapper from {pickle_path}")
                    return True

            # Fallback to individual files
            mapping_path = f"{embeddings_path}_mapping.json"
            embeddings_file = f"{embeddings_path}_embeddings.npy"

            if Path(mapping_path).exists() and Path(embeddings_file).exists():
                # Load mapping data
                with open(mapping_path, "r", encoding="utf-8") as f:
                    mapping_data = json.load(f)

                self.drug_names = mapping_data["drug_names"]
                self.drug_to_index = mapping_data["drug_to_index"]
                self.model_name = mapping_data["model_name"]

                # Load embeddings
                self.embeddings = np.load(embeddings_file)

                # Load model
                self.model = SentenceTransformer(self.model_name)

                self.is_loaded = True
                logger.info(
                    f"Loaded drug mapper from {mapping_path} and {embeddings_file}"
                )
                return True

        except Exception as e:
            logger.error(f"Failed to load drug mapper: {e}")
            return False

        logger.warning("No embedding files found")
        return False

    def map_drug_name(
        self, extracted_name: str, threshold: float = 0.7, top_k: int = 1
    ) -> Optional[str]:
        """
        Map an extracted drug name to the closest standardized drug name.

        Args:
            extracted_name: The drug name extracted from text/image
            threshold: Minimum similarity threshold for matching
            top_k: Number of top matches to consider

        Returns:
            The closest matching standardized drug name, or None if no match found
        """
        if not self.is_loaded:
            logger.error("Drug mapper not loaded. Call load_embeddings first.")
            return None

        if not extracted_name or not extracted_name.strip():
            return None

        # Clean the extracted name
        cleaned_name = extracted_name.strip().lower()

        # Check for exact match first (case-insensitive)
        for drug_name in self.drug_names:
            if drug_name.lower() == cleaned_name:
                return drug_name

        # Find closest match using embeddings
        try:
            results = self._find_closest_drugs(cleaned_name, top_k, threshold)
            print(f"drug_mapper - drug_name: {cleaned_name} results: {results}")
            if results:
                return results[0][0]  # Return the drug name of the best match
        except Exception as e:
            logger.error(f"Error finding closest drug for '{extracted_name}': {e}")

        return None

    def map_multiple_drugs(
        self, extracted_names: List[str], threshold: float = 0.7
    ) -> Dict[str, Optional[str]]:
        """
        Map multiple extracted drug names to standardized names.

        Args:
            extracted_names: List of extracted drug names
            threshold: Minimum similarity threshold for matching

        Returns:
            Dictionary mapping extracted names to standardized names
        """
        results = {}
        for name in extracted_names:
            results[name] = self.map_drug_name(name, threshold)
        return results

    def get_drug_suggestions(
        self, extracted_name: str, top_k: int = 5, threshold: float = 0.5
    ) -> List[Tuple[str, float]]:
        """
        Get multiple drug name suggestions with similarity scores.

        Args:
            extracted_name: The drug name to search for
            top_k: Number of suggestions to return
            threshold: Minimum similarity threshold

        Returns:
            List of tuples (drug_name, similarity_score)
        """
        if not self.is_loaded:
            logger.error("Drug mapper not loaded. Call load_embeddings first.")
            return []

        if not extracted_name or not extracted_name.strip():
            return []

        cleaned_name = extracted_name.strip().lower()
        return self._find_closest_drugs(cleaned_name, top_k, threshold)

    def _find_closest_drugs(
        self, query_drug: str, top_k: int = 5, threshold: float = 0.7
    ) -> List[Tuple[str, float]]:
        """
        Find the closest matching drug names using embeddings.

        Args:
            query_drug: The drug name to search for
            top_k: Number of top matches to return
            threshold: Minimum similarity threshold

        Returns:
            List of tuples (drug_name, similarity_score)
        """
        try:
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

        except Exception as e:
            logger.error(f"Error in similarity search: {e}")
            return []

    def get_all_drug_names(self) -> List[str]:
        """
        Get all available drug names.

        Returns:
            List of all drug names
        """
        return self.drug_names.copy() if self.is_loaded else []

    def is_drug_available(self, drug_name: str) -> bool:
        """
        Check if a drug name is available in the database.

        Args:
            drug_name: The drug name to check

        Returns:
            True if the drug is available, False otherwise
        """
        if not self.is_loaded:
            return False

        return drug_name.lower() in [name.lower() for name in self.drug_names]


# Global mapper instance
_drug_mapper = None


def get_drug_mapper(embeddings_path: str = "drug_embeddings") -> DrugNameMapper:
    """
    Get the global drug mapper instance.

    Args:
        embeddings_path: Path to the embedding files

    Returns:
        DrugNameMapper instance
    """
    global _drug_mapper

    if _drug_mapper is None or not _drug_mapper.is_loaded:
        _drug_mapper = DrugNameMapper()
        if not _drug_mapper.load_embeddings(embeddings_path):
            logger.error("Failed to load drug mapper")
            return None

    return _drug_mapper


def map_drug_name(
    extracted_name: str,
    threshold: float = 0.7,
    embeddings_path: str = "drug_embeddings",
) -> Optional[str]:
    """
    Convenience function to map a single drug name.

    Args:
        extracted_name: The drug name to map
        threshold: Minimum similarity threshold
        embeddings_path: Path to the embedding files

    Returns:
        Mapped drug name or None
    """
    mapper = get_drug_mapper(embeddings_path)
    if mapper:
        return mapper.map_drug_name(extracted_name, threshold)
    return None


def map_multiple_drugs(
    extracted_names: List[str],
    threshold: float = 0.7,
    embeddings_path: str = "drug_embeddings",
) -> Dict[str, Optional[str]]:
    """
    Convenience function to map multiple drug names.

    Args:
        extracted_names: List of drug names to map
        threshold: Minimum similarity threshold
        embeddings_path: Path to the embedding files

    Returns:
        Dictionary mapping extracted names to standardized names
    """
    mapper = get_drug_mapper(embeddings_path)
    if mapper:
        return mapper.map_multiple_drugs(extracted_names, threshold)
    return {name: None for name in extracted_names}
