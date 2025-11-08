import sys
import cv2
import numpy as np
from pathlib import Path
from typing import Optional, Dict, Any
from core.config import settings, PROJECT_ROOT

sys.path.insert(0, str(PROJECT_ROOT))

from ml.scripts.test_landmark_live import (
    HandLandmarkExtractor,
    MediaPipeHandDetector,
    ModelLoader,
    PredictionEngine,
    PredictionResult
)

from core.config import settings
sys.path.insert(0, str(settings.SCRIPTS_PATH))

class VisionService:
    """
    Service for computer vision operations, wrapping my openCV logic for the backend API essentially
    """
    
    def __init__(self):
        self.model_loaders = {
            "flute": ModelLoader(settings.MODEL_PATH),
            "hand": ModelLoader(settings.HAND_MODEL_PATH),
        }
        self.hand_detector = MediaPipeHandDetector()
        self.feature_extractor = HandLandmarkExtractor()
        self.prediction_engines: Dict[str, Optional[PredictionEngine]] = {"flute": None, "hand": None}
        self._is_initialized = False
    
    def initialize(self) -> bool:
        """Load the model and initialize the service."""
        if self._is_initialized:
            return True
        
        for mode, loader in self.model_loaders.items():
            print(f"→ Loading {mode} model from {loader.model_path}...")
            if loader.load():
                self.prediction_engines[mode] = PredictionEngine(
                    loader.model,
                    loader.classes
                )
                print(f"✓ {mode.capitalize()} model loaded successfully.")
            else:
                print(f" Failed to load {mode} model ({loader.model_path})")


        if not any(self.prediction_engines.values()):
            print("No models could be loaded.")
            return False

        print("✓ VisionService initialized and ready!")
        self._is_initialized = True
        return True
    
    def predict_from_image_bytes(self, image_bytes: bytes, model_mode: str) -> Dict[str, Any]:
        """
        Process an image and return gesture prediction.
        
        Args:
            image_bytes: Raw image bytes (JPEG, PNG, etc.)
            
        Returns:
            Dictionary with prediction results
        """
        if not self._is_initialized:
            return {"error": "Service not initialized"}

        if model_mode not in self.prediction_engines:
            return {"error": f"Invalid model mode '{model_mode}'"}
        print(f"PREDICT: Model mode {model_mode}")

        engine = self.prediction_engines.get(model_mode)
        if engine is None:
            return {"error": f"Model not loaded for mode '{model_mode}'"}
        
        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return {"error": "Could not decode image"}
        
        results = self.hand_detector.detect(frame)
        
        if not results.multi_hand_landmarks:
            return {
                "success": False,
                "gesture": None,
                "confidence": 0.0,
                "message": "No hands detected"
            }
        
        features = self.feature_extractor.extract_features(results.multi_hand_landmarks)
        
        if features is None:
            return {
                "success": False,
                "gesture": None,
                "confidence": 0.0,
                "message": "Could not extract features"
            }
        
        prediction_result: PredictionResult = engine.predict(features)
        
        return {
            "success": True,
            "gesture": prediction_result.predicted_class,
            "confidence": float(prediction_result.confidence),
            "all_predictions": {
                k: float(v) 
                for k, v in prediction_result.all_probabilities.items()
            }
        }
    
    def get_available_fingerings(self, model_mode: str) -> list:
        """Return list of fingerings the model can recognize."""
        if not self._is_initialized:
            return []

        if model_mode not in self.prediction_engines:
            return {"error": f"Invalid model mode '{model_mode}'"}

        loader = self.model_loaders.get(model_mode)
        if loader is None or loader.classes is None:
            return {"error": f"Model '{model_mode}' not loaded or classes unavailable"}

        return loader.classes

    def is_ready(self) -> bool:
        """Check if service is ready to make predictions."""
        return self._is_initialized and self.prediction_engines is not None
    
    def cleanup(self):
        """Clean up resources."""
        if self.hand_detector:
            self.hand_detector.close()
        self._is_initialized = False


# Global instance (created once when API starts)
vision_service = VisionService()