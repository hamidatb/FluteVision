from pathlib import Path

# ml is now inside backend, so PROJECT_ROOT is backend folder
PROJECT_ROOT = Path(__file__).parent.parent.parent  # backend/
SCRIPTS_DIR = PROJECT_ROOT / "ml" / "scripts"
MODEL_PATH = PROJECT_ROOT / "ml" / "models" / "landmark_model.pkl"
SAVED_DATASETS_DIR = PROJECT_ROOT / "ml" / "datasets" / "raw"