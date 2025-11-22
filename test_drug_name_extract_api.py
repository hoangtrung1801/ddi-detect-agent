"""Test script for drug name extraction API endpoint."""

import requests
import json
import os

# Base URL for the API
BASE_URL = "http://localhost:8000"


def test_drug_name_extract_from_url():
    """Test drug name extraction from image URL."""
    endpoint = f"{BASE_URL}/api/drug-name-extract"

    # Example payload with an image URL
    payload = {"image_url": "https://example.com/drug-package.jpg"}

    try:
        response = requests.post(endpoint, json=payload)
        response.raise_for_status()

        result = response.json()
        print("Success!")
        print(f"Timestamp: {result['timestamp']}")
        print(f"Result: {result['result']}")

        # Try to parse the result as JSON
        try:
            parsed_result = json.loads(result["result"])
            print("\nParsed Result:")
            print(json.dumps(parsed_result, indent=2))
        except json.JSONDecodeError:
            print("\nNote: Result is not valid JSON")

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")


def test_drug_name_extract_from_base64():
    """Test drug name extraction from base64-encoded image."""
    endpoint = f"{BASE_URL}/api/drug-name-extract"

    # Example payload with a base64-encoded image
    # Note: This is a placeholder, replace with actual base64 image
    payload = {"image_url": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."}

    try:
        response = requests.post(endpoint, json=payload)
        response.raise_for_status()

        result = response.json()
        print("Success!")
        print(f"Timestamp: {result['timestamp']}")
        print(f"Result: {result['result']}")

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")


def test_drug_name_extract_from_upload():
    """Test drug name extraction from uploaded image file."""
    endpoint = f"{BASE_URL}/api/drug-name-extract/upload"

    # Example: Upload a local image file
    # Replace with the path to an actual drug packaging image
    image_path = "drug-image.jpg"

    if not os.path.exists(image_path):
        print(f"Image file not found: {image_path}")
        print("Please provide a valid image path to test the upload endpoint.")
        return

    try:
        with open(image_path, "rb") as f:
            files = {"file": (os.path.basename(image_path), f, "image/jpeg")}
            response = requests.post(endpoint, files=files)
            response.raise_for_status()

        result = response.json()
        print("Success!")
        print(f"Timestamp: {result['timestamp']}")
        print(f"Result: {result['result']}")

        # Try to parse the result as JSON
        try:
            parsed_result = json.loads(result["result"])
            print("\nParsed Result:")
            print(json.dumps(parsed_result, indent=2))
        except json.JSONDecodeError:
            print("\nNote: Result is not valid JSON")

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        if hasattr(e, "response") and e.response is not None:
            print(f"Response: {e.response.text}")


if __name__ == "__main__":
    print("Testing drug name extraction API...\n")
    print("=" * 60)
    print("Test 1: Image URL")
    print("=" * 60)
    test_drug_name_extract_from_url()

    print("\n" + "=" * 60)
    print("Test 2: Base64 Image (placeholder)")
    print("=" * 60)
    # Uncomment to test with base64
    # test_drug_name_extract_from_base64()

    print("\n" + "=" * 60)
    print("Test 3: Upload Image File (requires Cloudinary)")
    print("=" * 60)
    test_drug_name_extract_from_upload()
