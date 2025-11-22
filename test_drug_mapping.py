#!/usr/bin/env python3
"""
Test Drug Mapping System

This script demonstrates how to use the drug mapping system
once the embeddings are generated.
"""

import sys
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent / "app"))


def test_drug_mapping():
    """Test the drug mapping functionality."""

    print("Drug Mapping System Test")
    print("=" * 40)

    # Check if embedding files exist
    embedding_files = [
        "drug_embeddings_embeddings.npy",
        "drug_embeddings_mapping.json",
        "drug_embeddings_mapper.pkl",
    ]

    missing_files = []
    for file in embedding_files:
        if not Path(file).exists():
            missing_files.append(file)

    if missing_files:
        print("❌ Missing embedding files:")
        for file in missing_files:
            print(f"   - {file}")
        print("\nTo generate embeddings, run:")
        print("   python3 generate_drug_embeddings.py")
        print("\nOr install dependencies first:")
        print("   pip3 install sentence-transformers scikit-learn")
        return False

    print("✅ All embedding files found")

    try:
        # Import the drug mapper
        from app.core.drug_mapper import (
            get_drug_mapper,
            map_drug_name,
            map_multiple_drugs,
        )

        # Load the mapper
        print("\nLoading drug mapper...")
        mapper = get_drug_mapper("drug_embeddings")

        if not mapper:
            print("❌ Failed to load drug mapper")
            return False

        print("✅ Drug mapper loaded successfully")
        print(f"   Total drugs available: {len(mapper.get_all_drug_names())}")

        # Test single drug mapping
        print("\n" + "=" * 40)
        print("Single Drug Mapping Tests")
        print("=" * 40)

        test_drugs = [
            "aspirin",
            "warfarin",
            "ibuprofen",
            "tylenol",  # Should map to acetaminophen
            "advil",  # Should map to ibuprofen
            "metformin",
            "lisinopril",
            "simvastatin",
            "omeprazole",
            "amlodipine",
        ]

        for drug in test_drugs:
            mapped = map_drug_name(drug, threshold=0.6)
            status = "✅" if mapped else "❌"
            print(f"{status} '{drug}' -> '{mapped}'")

        # Test multiple drug mapping
        print("\n" + "=" * 40)
        print("Multiple Drug Mapping Test")
        print("=" * 40)

        multiple_results = map_multiple_drugs(test_drugs[:5], threshold=0.8)
        for original, mapped in multiple_results.items():
            status = "✅" if mapped else "❌"
            print(f"{status} '{original}' -> '{mapped}'")

        # Test drug suggestions
        print("\n" + "=" * 40)
        print("Drug Suggestions Test")
        print("=" * 40)

        suggestion_tests = ["aspirin", "warfarin", "tylenol"]
        for drug in suggestion_tests:
            print(f"\nSuggestions for '{drug}':")
            suggestions = mapper.get_drug_suggestions(drug, top_k=3, threshold=0.8)
            for i, (suggested_drug, score) in enumerate(suggestions, 1):
                print(f"  {i}. {suggested_drug} (similarity: {score:.3f})")

        print("\n" + "=" * 40)
        print("✅ All tests completed successfully!")
        print("=" * 40)

        return True

    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Make sure to install required dependencies:")
        print("   pip3 install sentence-transformers scikit-learn")
        return False
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_drug_mapping()
    sys.exit(0 if success else 1)
