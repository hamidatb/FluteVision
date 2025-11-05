from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = PROJECT_ROOT / "ml" / "scripts"
MODEL_PATH = PROJECT_ROOT / "ml" / "models" / "landmark_model.pkl"
SAVED_DATASETS_DIR = PROJECT_ROOT / "ml" / "datasets" / "raw"