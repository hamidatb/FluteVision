
from fastapi import APIRouter, File, UploadFile, HTTPException
from typing import Dict, Any

from services import vision_service

router = APIRouter()

@router.get("/")
async def root():
    """API root endpoint."""
    return {
        "message": "FluteVision API",
        "version": "1.0.0",
        "status": "running"
    }


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Health check endpoint.
    Returns API status and model information.
    """
    is_ready = vision_service.is_ready()
    gestures = vision_service.get_available_gestures()
    
    return {
        "status": "healthy" if is_ready else "not ready",
        "model_loaded": is_ready,
        "available_gestures": gestures,
        "gesture_count": len(gestures)
    }


@router.post("/predict")
async def predict_gesture(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    TODO: Make this work with a livestream
    Predict gesture from uploaded image.
    
    Args:
        file: Image file (JPEG, PNG, etc.)
        
    Returns:
        Prediction results including gesture, confidence, and all probabilities
    """
    if not vision_service.is_ready():
        raise HTTPException(status_code=503, detail="Service not ready")
    
    # Read image bytes
    try:
        image_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    
    # Get prediction
    result = vision_service.predict_from_image_bytes(image_bytes)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


@router.get("/fingerings")
async def list_gestures():
    """Get list of all recognizable fingerings."""
    if not vision_service.is_ready():
        raise HTTPException(status_code=503, detail="Service not ready")
    
    fingerings = vision_service.get_available_fingerings()
    return {
        "fingerings": fingerings,
        "count": len(fingerings)
    }