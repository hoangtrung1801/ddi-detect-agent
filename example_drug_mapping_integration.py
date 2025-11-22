#!/usr/bin/env python3
"""
Example: Drug Mapping Integration with DDI Agent

This example shows how to integrate the drug mapping system
with your existing DDI agent workflow.
"""

import sys
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent / "app"))


def example_drug_extraction_and_mapping():
    """
    Example workflow showing drug extraction followed by mapping.
    """
    print("Drug Extraction and Mapping Example")
    print("=" * 50)

    # Simulate extracted drug names from OCR/text processing
    extracted_drugs = [
        "aspirin",
        "warfarin",
        "tylenol",  # Brand name for acetaminophen
        "advil",  # Brand name for ibuprofen
        "metformin",
        "lisinopril",
        "simvastatin",
        "omeprazole",
        "amlodipine",
        "metoprolol",
    ]

    print(f"Extracted drug names: {extracted_drugs}")
    print()

    try:
        # Import the drug mapping functions
        from app.core.drug_mapper import (
            map_drug_name,
            map_multiple_drugs,
            get_drug_mapper,
        )

        # Check if embeddings are available
        mapper = get_drug_mapper()
        if not mapper:
            print("❌ Drug mapper not available. Please run:")
            print("   python3 generate_drug_embeddings.py")
            return

        print("✅ Drug mapper loaded successfully")
        print(f"   Total drugs in database: {len(mapper.get_all_drug_names())}")
        print()

        # Method 1: Map drugs one by one
        print("Method 1: Individual Drug Mapping")
        print("-" * 30)
        individual_mappings = {}
        for drug in extracted_drugs:
            mapped = map_drug_name(drug, threshold=0.6)
            individual_mappings[drug] = mapped
            status = "✅" if mapped else "❌"
            print(f"{status} '{drug}' -> '{mapped}'")

        print()

        # Method 2: Map all drugs at once
        print("Method 2: Batch Drug Mapping")
        print("-" * 30)
        batch_mappings = map_multiple_drugs(extracted_drugs, threshold=0.6)
        for original, mapped in batch_mappings.items():
            status = "✅" if mapped else "❌"
            print(f"{status} '{original}' -> '{mapped}'")

        print()

        # Method 3: Get detailed mapping results with confidence scores
        print("Method 3: Detailed Mapping with Confidence Scores")
        print("-" * 50)
        for drug in extracted_drugs[:5]:  # Show first 5 for brevity
            suggestions = mapper.get_drug_suggestions(drug, top_k=3, threshold=0.5)
            if suggestions:
                best_match = suggestions[0]
                confidence = (
                    "High"
                    if best_match[1] > 0.8
                    else "Medium" if best_match[1] > 0.6 else "Low"
                )
                print(
                    f"'{drug}' -> '{best_match[0]}' (confidence: {confidence}, score: {best_match[1]:.3f})"
                )

                # Show alternative suggestions
                if len(suggestions) > 1:
                    print(
                        f"  Alternatives: {[f'{name} ({score:.3f})' for name, score in suggestions[1:]]}"
                    )
            else:
                print(f"'{drug}' -> No match found")
            print()

        # Method 4: Filter successful mappings for DDI checking
        print("Method 4: Filtered Mappings for DDI Agent")
        print("-" * 40)
        successful_mappings = {
            original: mapped for original, mapped in batch_mappings.items() if mapped
        }

        print(
            f"Successfully mapped {len(successful_mappings)} out of {len(extracted_drugs)} drugs:"
        )
        for original, mapped in successful_mappings.items():
            print(f"  '{original}' -> '{mapped}'")

        print()
        print("These mapped drug names can now be used for drug interaction checking!")

        return successful_mappings

    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Please install dependencies:")
        print("   pip install sentence-transformers scikit-learn")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback

        traceback.print_exc()


def example_agent_integration():
    """
    Example showing how to integrate with LangGraph agent.
    """
    print("\n" + "=" * 50)
    print("LangGraph Agent Integration Example")
    print("=" * 50)

    try:
        from app.agents.drug_name_mapper_tool import (
            map_extracted_drug_name,
            map_multiple_drug_names,
            get_drug_suggestions,
        )

        # Example 1: Single drug mapping tool
        print("1. Single Drug Mapping Tool:")
        result = map_extracted_drug_name("tylenol", threshold=0.7)
        print(f"   Result: {result}")
        print()

        # Example 2: Multiple drug mapping tool
        print("2. Multiple Drug Mapping Tool:")
        drugs = ["aspirin", "warfarin", "ibuprofen"]
        result = map_multiple_drug_names(drugs, threshold=0.7)
        print(f"   Result: {result}")
        print()

        # Example 3: Drug suggestions tool
        print("3. Drug Suggestions Tool:")
        result = get_drug_suggestions("tylenol", top_k=3, threshold=0.5)
        print(f"   Result: {result}")
        print()

        print("✅ All LangGraph tools working correctly!")

    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Make sure the drug mapper is properly set up.")
    except Exception as e:
        print(f"❌ Error: {e}")


def example_workflow_integration():
    """
    Example showing complete workflow integration.
    """
    print("\n" + "=" * 50)
    print("Complete Workflow Integration Example")
    print("=" * 50)

    # Simulate a complete workflow
    print("Simulating complete DDI agent workflow:")
    print()

    # Step 1: Extract drug names (simulated)
    print("Step 1: Extract drug names from input")
    extracted_drugs = ["aspirin", "warfarin", "tylenol"]
    print(f"   Extracted: {extracted_drugs}")
    print()

    # Step 2: Map drug names
    print("Step 2: Map to standardized names")
    try:
        from app.core.drug_mapper import map_multiple_drugs

        mapped_drugs = map_multiple_drugs(extracted_drugs, threshold=0.6)
        print(f"   Mapped: {mapped_drugs}")
        print()

        # Step 3: Filter successful mappings
        print("Step 3: Filter successful mappings")
        valid_drugs = [mapped for mapped in mapped_drugs.values() if mapped]
        print(f"   Valid drugs for DDI checking: {valid_drugs}")
        print()

        # Step 4: Use for DDI checking (simulated)
        print("Step 4: Use mapped drugs for DDI checking")
        if valid_drugs:
            print(f"   Checking interactions between: {valid_drugs}")
            print("   [This would call your existing DDI checking logic]")
        else:
            print("   No valid drugs found for DDI checking")

        print()
        print("✅ Complete workflow integration successful!")

    except Exception as e:
        print(f"❌ Error in workflow: {e}")


if __name__ == "__main__":
    # Run all examples
    example_drug_extraction_and_mapping()
    example_agent_integration()
    example_workflow_integration()

    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    print("The drug mapping system provides:")
    print("✅ Semantic drug name matching")
    print("✅ Confidence scoring")
    print("✅ Alternative suggestions")
    print("✅ LangGraph agent integration")
    print("✅ Batch processing")
    print()
    print("To use in your DDI agent:")
    print("1. Run: python3 generate_drug_embeddings.py")
    print("2. Import: from app.core.drug_mapper import map_drug_name")
    print("3. Use: mapped_name = map_drug_name(extracted_name)")
    print("4. Check interactions with mapped_name")
