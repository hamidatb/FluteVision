
from fastapi import APIRouter, File, UploadFile, HTTPException, Request
from typing import Dict, Any

from services import vision_service
from services.limiter import limiter
from starlette.responses import JSONResponse

router = APIRouter()

@router.get("/")
async def root():
    """just a basic info endpoint"""
    return {
        "message": "FluteVision API",
        "version": "1.0.0",
        "status": "running"
    }


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    health check so frontend knows if backend is alive and model is loaded before trying to use camera
    """
    is_ready = vision_service.is_ready()
    gestures = vision_service.get_available_fingerings()
    
    return {
        "status": "healthy" if is_ready else "not ready",
        "model_loaded": is_ready,
        "available_gestures": gestures,
        "gesture_count": len(gestures)
    }


@router.post("/predict")
async def predict_gesture(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    predict from uploaded file (multipart) - kept this for testing but base64 endpoint is faster for live streaming
    """
    if not vision_service.is_ready():
        raise HTTPException(status_code=503, detail="Service not ready")
    
    try:
        image_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    
    result = vision_service.predict_from_image_bytes(image_bytes)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.post("/predict/base64")
@limiter.limit("600/minute")  # 10 FPS for thr prediction stream
async def predict_gesture_base64(request: Request, data: dict) -> Dict[str, Any]:
    """
    predict from base64 image - much faster than multipart bc less overhead, perfect for real-time streaming
    rate limited to prevent abuse
    """
    if not vision_service.is_ready():
        raise HTTPException(status_code=503, detail="Service not ready")
    
    try:
        import base64
        image_data = data.get("image")
        if not image_data:
            raise HTTPException(status_code=400, detail="No image data provided")
        
        # strip the data:image/jpeg;base64, prefix if browser sent it
        if "," in image_data:
            image_data = image_data.split(",")[1]
        
        image_bytes = base64.b64decode(image_data)
        result = vision_service.predict_from_image_bytes(image_bytes)
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return JSONResponse(content=result)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing image: {str(e)}")
    
@router.get("/fingerings")
async def list_gestures():
    """returns what gestures the model knows so frontend can display them"""
    if not vision_service.is_ready():
        raise HTTPException(status_code=503, detail="Service not ready")
    
    fingerings = vision_service.get_available_fingerings()
    return {
        "fingerings": fingerings,
        "count": len(fingerings)
    }