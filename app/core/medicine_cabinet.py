"""Medicine Cabinet Manager for storing user medications."""

from typing import Dict, List, Set, Optional
from datetime import datetime
from collections import defaultdict

from app.core.drug_mapper import map_drug_name


class MedicineCabinetManager:
    """Manages medicine cabinets for users."""

    def __init__(self):
        """Initialize the medicine cabinet manager."""
        # Store drugs per user: {user_id: Set[drug_name]}
        self.cabinets: Dict[str, Set[str]] = defaultdict(set)
        # Store interaction results: {user_id: {drug_name: List[interaction_info]}}
        self.interaction_results: Dict[str, Dict[str, List[Dict]]] = defaultdict(
            lambda: defaultdict(list)
        )

    def add_drug(self, user_id: str, drug_name: str) -> bool:
        """
        Add a drug to user's medicine cabinet.

        Args:
            user_id: User identifier
            drug_name: Name of the drug to add

        Returns:
            True if added, False if already exists
        """
        drug_name_normalized = self.map_drug_name(drug_name)
        if drug_name in self.cabinets[user_id]:
            return False

        self.cabinets[user_id].add(drug_name_normalized)
        return True

    def remove_drug(self, user_id: str, drug_name: str) -> bool:
        """
        Remove a drug from user's medicine cabinet.

        Args:
            user_id: User identifier
            drug_name: Name of the drug to remove

        Returns:
            True if removed, False if not found
        """
        drug_name_normalized = self.map_drug_name(drug_name)
        if drug_name_normalized not in self.cabinets[user_id]:
            return False

        self.cabinets[user_id].remove(drug_name)
        # Clean up interaction results for this drug
        if (
            user_id in self.interaction_results
            and drug_name_normalized in self.interaction_results[user_id]
        ):
            del self.interaction_results[user_id][drug_name_normalized]
        return True

    def get_drugs(self, user_id: str) -> List[str]:
        """
        Get all drugs in user's medicine cabinet.

        Args:
            user_id: User identifier

        Returns:
            List of drug names
        """
        return sorted(list(self.cabinets[user_id]))

    def has_drug(self, user_id: str, drug_name: str) -> bool:
        """
        Check if user has a specific drug in their cabinet.

        Args:
            user_id: User identifier
            drug_name: Name of the drug to check

        Returns:
            True if drug exists in cabinet
        """
        drug_name_normalized = self.map_drug_name(drug_name)
        return drug_name in self.cabinets[user_id]

    def get_other_drugs(self, user_id: str, exclude_drug: str) -> List[str]:
        """
        Get all drugs except the excluded one.

        Args:
            user_id: User identifier
            exclude_drug: Drug name to exclude

        Returns:
            List of other drug names
        """
        exclude_normalized = self.map_drug_name(exclude_drug)
        return [drug for drug in self.cabinets[user_id] if drug != exclude_normalized]

    def map_drug_name(self, drug_name: str) -> str:
        """
        Map a drug name to its standardized form if mapping is enabled.
        First extracts active ingredient using LLM, then maps to database.

        Args:
            drug_name: The drug name to map

        Returns:
            Mapped drug name or original if mapping not available
        """

        try:
            mapped = map_drug_name(drug_name, threshold=0.5)
            return mapped if mapped else drug_name
        except Exception as e:
            print(f"Error in drug mapping: {e}")
            return drug_name.title()

    def save_interaction_result(
        self,
        user_id: str,
        drug1: str,
        drug2: str,
        interaction_info: Optional[str],
        severity: Optional[str] = None,
    ) -> None:
        """
        Save interaction check result.

        Args:
            user_id: User identifier
            drug1: First drug name
            drug2: Second drug name
            interaction_info: Interaction details or None if no interaction
            severity: Severity level if available
        """
        drug1_normalized = self.map_drug_name(drug1)
        drug2_normalized = self.map_drug_name(drug2)

        result = {
            "drug1": drug1_normalized,
            "drug2": drug2_normalized,
            "interaction": interaction_info,
            "has_interaction": interaction_info is not None,
            "severity": severity,
            "checked_at": datetime.utcnow().isoformat(),
        }

        # Store in both directions for easy lookup
        self.interaction_results[user_id][drug1_normalized].append(result)
        self.interaction_results[user_id][drug2_normalized].append(result)

    def get_interactions_for_drug(self, user_id: str, drug_name: str) -> List[Dict]:
        """
        Get all interaction results for a specific drug.

        Args:
            user_id: User identifier
            drug_name: Name of the drug

        Returns:
            List of interaction results
        """
        drug_name_normalized = self.map_drug_name(drug_name)
        return self.interaction_results[user_id].get(drug_name_normalized, [])

    def clear_cabinet(self, user_id: str) -> None:
        """
        Clear all drugs from user's medicine cabinet.

        Args:
            user_id: User identifier
        """
        self.cabinets[user_id].clear()
        if user_id in self.interaction_results:
            del self.interaction_results[user_id]


# Global medicine cabinet manager instance
medicine_cabinet_manager = MedicineCabinetManager()
