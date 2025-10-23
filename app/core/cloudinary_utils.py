"""Cloudinary utilities for image upload and management."""

import cloudinary
import cloudinary.uploader
from fastapi import UploadFile, HTTPException
from typing import Dict, Any

from app.core.config import settings


def configure_cloudinary() -> None:
    """Configure Cloudinary with credentials from settings."""
    if not all(
        [
            settings.CLOUDINARY_CLOUD_NAME,
            settings.CLOUDINARY_API_KEY,
            settings.CLOUDINARY_API_SECRET,
        ]
    ):
        raise ValueError(
            "Cloudinary credentials not configured. Please set "
            "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET "
            "in your environment variables."
        )

    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


async def upload_image_to_cloudinary(
    file: UploadFile, folder: str = "drug-images", resource_type: str = "image"
) -> Dict[str, Any]:
    """
    Upload an image to Cloudinary temporarily.

    Args:
        file: The uploaded file from FastAPI
        folder: Cloudinary folder to store the image
        resource_type: Type of resource (default: "image")

    Returns:
        Dict containing upload result with 'secure_url', 'public_id', etc.

    Raises:
        HTTPException: If upload fails or file type is invalid
    """
    try:
        # Configure Cloudinary
        configure_cloudinary()

        # Validate file type
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {file.content_type}. Only images are allowed.",
            )

        # Read file content
        contents = await file.read()

        # Upload to Cloudinary
        upload_result = cloudinary.uploader.upload(
            contents,
            folder=folder,
            resource_type=resource_type,
            # Auto-delete after 1 hour (3600 seconds)
            # Note: This requires Cloudinary Pro plan or higher
            # For free tier, you may need to manually delete later
            tags=["temporary", "drug-extraction"],
        )

        return upload_result

    except cloudinary.exceptions.Error as e:
        raise HTTPException(
            status_code=500, detail=f"Cloudinary upload failed: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading image: {str(e)}")
    finally:
        # Reset file pointer for potential reuse
        await file.seek(0)


def delete_image_from_cloudinary(public_id: str) -> Dict[str, Any]:
    """
    Delete an image from Cloudinary.

    Args:
        public_id: The public ID of the image to delete

    Returns:
        Dict containing deletion result
    """
    try:
        configure_cloudinary()
        result = cloudinary.uploader.destroy(public_id)
        return result
    except Exception as e:
        # Log the error but don't fail the request
        print(f"Warning: Failed to delete image from Cloudinary: {str(e)}")
        return {"error": str(e)}


def is_cloudinary_configured() -> bool:
    """Check if Cloudinary is properly configured."""
    return all(
        [
            settings.CLOUDINARY_CLOUD_NAME,
            settings.CLOUDINARY_API_KEY,
            settings.CLOUDINARY_API_SECRET,
        ]
    )
