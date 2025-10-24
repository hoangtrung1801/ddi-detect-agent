"""Query and chat endpoints."""

from datetime import datetime
from fastapi import APIRouter, HTTPException, status, UploadFile, File

from app.models import (
    QueryRequest,
    QueryResponse,
    ChatRequest,
    ChatResponse,
    ErrorResponse,
)
from pydantic import BaseModel
from app.core.agent import agent_manager
from app.models.requests import DrugNamesFromImageRequest
from app.models.responses import DrugNamesFromImageResponse
from app.agents.drug_name_extract_agent import DrugNameExtractAgent
from app.core.cloudinary_utils import (
    upload_image_to_cloudinary,
    delete_image_from_cloudinary,
    is_cloudinary_configured,
)

router = APIRouter()


class TranslationResponse(BaseModel):
    """Response model for translation endpoint."""

    english: str
    vietnamese: str
    timestamp: str


@router.post(
    "/query",
    response_model=QueryResponse,
    summary="Query Drug Interactions",
    description="Ask a question about drug interactions without session management",
    tags=["Queries"],
    responses={
        200: {"description": "Successful response"},
        503: {"model": ErrorResponse, "description": "Agent not available"},
    },
)
async def query_drug_interaction(request: QueryRequest):
    """
    Simple query endpoint without session management.
    Each query is independent with no conversation history.
    """
    try:
        agent = agent_manager.get_agent()
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Agent not loaded"
        )

    try:
        # Clear memory to ensure no history
        agent.clear_memory()

        # Process query
        answer = agent.query(request.question)

        print(f"Answer: {answer}")
        return QueryResponse(answer=answer, timestamp=datetime.utcnow().isoformat())

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing query: {str(e)}",
        )


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Chat with Session",
    description="Ask questions with conversation history maintained via session ID",
    tags=["Chat"],
    responses={
        200: {"description": "Successful response"},
        503: {"model": ErrorResponse, "description": "Agent not available"},
    },
)
async def chat_with_session(request: ChatRequest):
    """
    Chat endpoint with session management.
    Maintains conversation history across requests using session_id.
    """
    try:
        agent_manager.get_agent()
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Agent not loaded"
        )

    try:
        # Get or create session
        session_id, session_agent = agent_manager.get_or_create_session(
            request.session_id
        )

        # Process query with session agent
        answer = session_agent.query(request.question)

        return ChatResponse(
            answer=answer,
            session_id=session_id,
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing chat: {str(e)}",
        )


@router.delete(
    "/chat/{session_id}",
    summary="Clear Session",
    description="Clear conversation history for a specific session",
    tags=["Chat"],
)
async def clear_session(session_id: str):
    """Clear or delete a chat session."""
    if agent_manager.clear_session(session_id):
        return {"message": f"Session {session_id} cleared", "success": True}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )


@router.post(
    "/drug-name-extract",
    response_model=DrugNamesFromImageResponse,
    summary="Extract drug names from image URL",
    description="Extract active ingredients from an image URL or base64-encoded image",
    tags=["Queries"],
    responses={
        200: {"description": "Successful response"},
        500: {
            "model": ErrorResponse,
            "description": "Error processing drug names extraction",
        },
    },
)
async def extract_drug_names_from_image(request: DrugNamesFromImageRequest):
    """
    Extract active ingredients from drug packaging image.

    Accepts either a URL or base64-encoded image and returns:
    - Reasoning steps showing how ingredients were identified
    - List of active ingredients with their strengths
    """
    try:
        # Initialize the drug name extract agent
        agent = DrugNameExtractAgent(verbose=False)

        # Extract drug names from the image
        result = agent.extract_drug_names_from_image(request.image_url)

        return DrugNamesFromImageResponse(
            result=result, timestamp=datetime.utcnow().isoformat()
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing image: {str(e)}",
        )


@router.post(
    "/drug-name-extract/upload",
    response_model=DrugNamesFromImageResponse,
    summary="Extract drug names from uploaded image",
    description="Upload an image and extract active ingredients (uses Cloudinary for temporary storage)",
    tags=["Queries"],
    responses={
        200: {"description": "Successful response"},
        400: {
            "model": ErrorResponse,
            "description": "Invalid file type or Cloudinary not configured",
        },
        500: {
            "model": ErrorResponse,
            "description": "Error processing drug names extraction",
        },
    },
)
async def extract_drug_names_from_upload(
    file: UploadFile = File(..., description="Image file of drug packaging or label")
):
    """
    Extract active ingredients from uploaded drug packaging image.

    The image is temporarily uploaded to Cloudinary, processed, and then deleted.

    Accepts:
    - Image file (JPEG, PNG, GIF, WebP)

    Returns:
    - Reasoning steps showing how ingredients were identified
    - List of active ingredients with their strengths
    """
    # Check if Cloudinary is configured
    if not is_cloudinary_configured():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in environment variables.",
        )

    public_id = None

    try:
        # Upload image to Cloudinary
        upload_result = await upload_image_to_cloudinary(file)
        public_id = upload_result.get("public_id")
        image_url = upload_result.get("secure_url")

        if not image_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get image URL from Cloudinary",
            )

        # Initialize the drug name extract agent
        agent = DrugNameExtractAgent(verbose=False)

        # Extract drug names from the image
        result = agent.extract_drug_names_from_image(image_url)

        return DrugNamesFromImageResponse(
            result=result, timestamp=datetime.utcnow().isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing image: {str(e)}",
        )
    finally:
        pass
        # Clean up: Delete the temporary image from Cloudinary
        # if public_id:
        #     try:
        #         delete_image_from_cloudinary(public_id)
        #     except Exception as e:
        #         # Log the error but don't fail the request
        #         print(f"Warning: Failed to delete temporary image: {str(e)}")


@router.post(
    "/query-translate",
    response_model=TranslationResponse,
    summary="Query Drug Interactions with Vietnamese Translation",
    description="Ask a question about drug interactions and get both English and Vietnamese responses",
    tags=["Queries"],
    responses={
        200: {"description": "Successful response with translation"},
        503: {"model": ErrorResponse, "description": "Agent not available"},
    },
)
async def query_drug_interaction_with_translation(request: QueryRequest):
    """
    Query endpoint that returns both English and Vietnamese responses.
    """
    try:
        agent = agent_manager.get_agent()
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Agent not loaded"
        )

    try:
        # Use the new translation method
        result = agent.invoke_with_translation(request.question)

        return TranslationResponse(
            english=result["english"],
            vietnamese=result["vietnamese"],
            timestamp=datetime.now().isoformat(),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing query: {str(e)}",
        )
