from pathlib import Path
from typing import List
import os

class Settings:
    # API Settings
    API_TITLE: str = "FluteVision API"
    API_VERSION: str = "1.0.0"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://flutevision-web-cd91d82764ea.herokuapp.com",
    ] 
    
    # Paths
    PROJECT_ROOT: Path = Path(__file__).parent.parent  # backend folder
    SCRIPTS_PATH: Path = PROJECT_ROOT / "ml" / "scripts"
    MODEL_PATH: Path = PROJECT_ROOT / "ml" / "models" / "landmark_model.pkl"
    SAVED_DATASETS_DIR = PROJECT_ROOT / "ml" / "datasets" / "raw"
    
    # odel Settings
    CONFIDENCE_THRESHOLD: float = 0.5

settings = Settings()

PROJECT_ROOT = settings.PROJECT_ROOT
SCRIPTS_PATH = settings.SCRIPTS_PATH
MODEL_PATH = settings.MODEL_PATH
SAVED_DATASETS_DIR = settings.SAVED_DATASETS_DIR