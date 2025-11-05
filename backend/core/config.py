from pathlib import Path
from typing import List

class Settings:
    # API Settings
    API_TITLE: str = "FluteVision API"
    API_VERSION: str = "1.0.0"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    # CORS Settings
    ALLOWED_ORIGINS: List[str] = ["*"] 
    
    # Paths
    PROJECT_ROOT: Path = Path(__file__).parent.parent.parent
    SCRIPTS_PATH: Path = PROJECT_ROOT / "scripts"
    MODEL_PATH: Path = PROJECT_ROOT / "ml" / "models" / "landmark_model.pkl"
    SAVED_DATASETS_DIR = PROJECT_ROOT / "datasets" / "raw"
    
    # odel Settings
    CONFIDENCE_THRESHOLD: float = 0.5

settings = Settings()

PROJECT_ROOT = settings.PROJECT_ROOT
SCRIPTS_PATH = settings.SCRIPTS_PATH
MODEL_PATH = settings.MODEL_PATH
SAVED_DATASETS_DIR = settings.SAVED_DATASETS_DIR