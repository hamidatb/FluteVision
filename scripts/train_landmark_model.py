"""
Train a flute fingering classifier using MediaPipe hand landmarks as features.

This approach uses the landmark COORDINATES directly (like sign language recognition)
instead of drawing them on images and using a CNN.
"""

import sys
import pickle
import numpy as np
from pathlib import Path
from typing import List, Optional, Tuple, Dict
from dataclasses import dataclass
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import cv2
import os

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import warnings
warnings.filterwarnings('ignore', category=UserWarning)

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    print("MediaPipe not available!")
    sys.exit(1)


@dataclass
class TrainingConfig:
    """Configuration for model training."""
    raw_data_dir: Path
    test_size: float = 0.3
    val_size: float = 0.33
    n_estimators: int = 100
    max_depth: int = 10
    random_state: int = 42


@dataclass
class DatasetSplit:
    """Container for train/val/test splits."""
    X_train: np.ndarray
    X_val: np.ndarray
    X_test: np.ndarray
    y_train: np.ndarray
    y_val: np.ndarray
    y_test: np.ndarray
    classes: List[str]


@dataclass
class EvaluationMetrics:
    """Container for model evaluation results."""
    train_accuracy: float
    val_accuracy: float
    test_accuracy: float
    per_class_metrics: Dict[str, Dict]


class HandLandmarkExtractor:
    """
    Extracts numerical features from hand landmarks in images.
    
    This is similar to the extractor in test_landmark_live.py but operates on static images rather than video frames for training purposes.
    """
    
    def __init__(self):
        self.expected_feature_count = 120
        self.mp_hands = mp.solutions.hands
    
    def extract_from_image(self, image_path: Path) -> Optional[np.ndarray]:
        """
        Extract landmark features from an image file.
        
        I use static_image_mode=False and lower confidence thresholds because the training images vary in quality and hand positioning angles.
        """
        hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.3,
            min_tracking_confidence=0.3
        )
        
        img = cv2.imread(str(image_path))
        if img is None:
            return None
        
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = hands.process(img_rgb)
        hands.close()
        
        if not results.multi_hand_landmarks:
            return None
        
        features = self._extract_features_from_landmarks(results.multi_hand_landmarks)
        return np.array(features[:self.expected_feature_count])
    
    def _extract_features_from_landmarks(self, hand_landmarks_list) -> List[float]:
        """
        Converting raw landmarks into numerical features.
        """
        features = []
        
        for hand_landmarks in hand_landmarks_list:
            landmarks = hand_landmarks.landmark
            
            wrist = landmarks[0]
            thumb_tip, thumb_ip, thumb_mcp, thumb_cmc = landmarks[4], landmarks[3], landmarks[2], landmarks[1]
            index_tip, index_dip, index_pip, index_mcp = landmarks[8], landmarks[7], landmarks[6], landmarks[5]
            middle_tip, middle_dip, middle_pip, middle_mcp = landmarks[12], landmarks[11], landmarks[10], landmarks[9]
            ring_tip, ring_dip, ring_pip, ring_mcp = landmarks[16], landmarks[15], landmarks[14], landmarks[13]
            pinky_tip, pinky_dip, pinky_pip, pinky_mcp = landmarks[20], landmarks[19], landmarks[18], landmarks[17]
            
            finger_tips = [index_tip, middle_tip, ring_tip, pinky_tip]
            mcps = [index_mcp, middle_mcp, ring_mcp, pinky_mcp]
            
            features.extend(self._compute_finger_bend_features(
                thumb_tip, thumb_ip, thumb_mcp, thumb_cmc,
                index_tip, index_dip, index_pip, index_mcp,
                middle_tip, middle_dip, middle_pip, middle_mcp,
                ring_tip, ring_dip, ring_pip, ring_mcp,
                pinky_tip, pinky_dip, pinky_pip, pinky_mcp
            ))
            features.extend(self._compute_fingertip_orientations(wrist, middle_mcp, finger_tips))
            features.extend(self._compute_interfinger_spacing(finger_tips))
            features.extend(self._compute_finger_height_relativity(finger_tips))
            features.extend(self._compute_joint_angles(
                index_mcp, index_pip, index_dip,
                middle_mcp, middle_pip, middle_dip,
                ring_mcp, ring_pip, ring_dip,
                pinky_mcp, pinky_pip, pinky_dip
            ))
            features.extend(self._compute_thumb_positioning(thumb_tip, thumb_cmc, finger_tips))
            features.extend(self._compute_hand_orientation(wrist, middle_mcp, index_mcp, pinky_mcp))
            features.extend(self._compute_finger_straightness(finger_tips, mcps))
        
        while len(features) < self.expected_feature_count:
            features.append(0.0)
        
        return features
    
    @staticmethod
    def _distance(p1, p2) -> float:
        return ((p1.x - p2.x)**2 + (p1.y - p2.y)**2)**0.5
    
    @staticmethod
    def _angle_between_vectors(v1, v2) -> float:
        cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
        cos_angle = np.clip(cos_angle, -1.0, 1.0)
        return np.arccos(cos_angle)
    
    def _finger_bend_level(self, tip, dip, pip, mcp) -> float:
        """
        Measuring bend as a ratio to make it scale-invariant across different hand sizes and camera distances.
        """
        tip_to_mcp = self._distance(tip, mcp)
        pip_to_mcp = self._distance(pip, mcp)
        if pip_to_mcp > 0:
            return max(0, 1 - (tip_to_mcp / pip_to_mcp))
        return 0
    
    @staticmethod
    def _is_finger_down(tip, pip) -> float:
        """
        Using binary up/down state in addition to continuous bend level because some fingering patterns have sharp state transitions.
        """
        return 1.0 if tip.y > pip.y else 0.0
    
    def _compute_finger_bend_features(self, thumb_tip, thumb_ip, thumb_mcp, thumb_cmc,
                                      index_tip, index_dip, index_pip, index_mcp,
                                      middle_tip, middle_dip, middle_pip, middle_mcp,
                                      ring_tip, ring_dip, ring_pip, ring_mcp,
                                      pinky_tip, pinky_dip, pinky_pip, pinky_mcp) -> List[float]:
        return [
            self._finger_bend_level(index_tip, index_dip, index_pip, index_mcp),
            self._finger_bend_level(middle_tip, middle_dip, middle_pip, middle_mcp),
            self._finger_bend_level(ring_tip, ring_dip, ring_pip, ring_mcp),
            self._finger_bend_level(pinky_tip, pinky_dip, pinky_pip, pinky_mcp),
            self._finger_bend_level(thumb_tip, thumb_ip, thumb_mcp, thumb_cmc),
            self._is_finger_down(index_tip, index_pip),
            self._is_finger_down(middle_tip, middle_pip),
            self._is_finger_down(ring_tip, ring_pip),
            self._is_finger_down(pinky_tip, pinky_pip),
            self._is_finger_down(thumb_tip, thumb_ip),
        ]
    
    def _compute_fingertip_orientations(self, wrist, middle_mcp, finger_tips) -> List[float]:
        """
        Computing angles relative to hand center rather than absolute screen coordinates to make features invariant to hand rotation.
        """
        hand_center = np.array([(wrist.x + middle_mcp.x) / 2, (wrist.y + middle_mcp.y) / 2])
        orientations = []
        for tip in finger_tips:
            tip_vector = np.array([tip.x - hand_center[0], tip.y - hand_center[1]])
            tip_angle = np.arctan2(tip_vector[1], tip_vector[0])
            orientations.append(tip_angle)
        return orientations
    
    def _compute_interfinger_spacing(self, finger_tips) -> List[float]:
        """
        Measuring both adjacent and non-adjacent finger distances because some notes require spreading specific fingers apart.
        """
        index_tip, middle_tip, ring_tip, pinky_tip = finger_tips
        finger_pairs = [
            (index_tip, middle_tip), (middle_tip, ring_tip), (ring_tip, pinky_tip),
            (index_tip, ring_tip), (index_tip, pinky_tip), (middle_tip, pinky_tip)
        ]
        return [self._distance(tip1, tip2) for tip1, tip2 in finger_pairs]
    
    def _compute_finger_height_relativity(self, finger_tips) -> List[float]:
        """
        Normalizing heights to a 0-1 scale based on the current frame's min/max to handle varying camera angles gracefully.
        """
        finger_heights = [tip.y for tip in finger_tips]
        min_height = min(finger_heights)
        max_height = max(finger_heights)
        hand_span = max_height - min_height
        
        if hand_span > 0:
            return [(height - min_height) / hand_span for height in finger_heights]
        return [0.5, 0.5, 0.5, 0.5]
    
    def _joint_angle(self, p1, p2, p3) -> float:
        v1 = np.array([p1.x - p2.x, p1.y - p2.y])
        v2 = np.array([p3.x - p2.x, p3.y - p2.y])
        return self._angle_between_vectors(v1, v2)
    
    def _compute_joint_angles(self, index_mcp, index_pip, index_dip,
                              middle_mcp, middle_pip, middle_dip,
                              ring_mcp, ring_pip, ring_dip,
                              pinky_mcp, pinky_pip, pinky_dip) -> List[float]:
        """
        Only using PIP joint angles rather than all joints because they're the most stable and less affected by MediaPipe detection noise.
        """
        return [
            self._joint_angle(index_mcp, index_pip, index_dip),
            self._joint_angle(middle_mcp, middle_pip, middle_dip),
            self._joint_angle(ring_mcp, ring_pip, ring_dip),
            self._joint_angle(pinky_mcp, pinky_pip, pinky_dip),
        ]
    
    def _compute_thumb_positioning(self, thumb_tip, thumb_cmc, finger_tips) -> List[float]:
        """
        Tracking thumb-to-finger distances separately because thumb position is critical for distinguishing many flute fingering patterns.
        """
        thumb_vector = np.array([thumb_tip.x - thumb_cmc.x, thumb_tip.y - thumb_cmc.y])
        thumb_angle = np.arctan2(thumb_vector[1], thumb_vector[0])
        
        features = [thumb_angle]
        for tip in finger_tips:
            features.extend([
                self._distance(thumb_tip, tip),
                thumb_tip.x - tip.x,
                thumb_tip.y - tip.y,
            ])
        return features
    
    def _compute_hand_orientation(self, wrist, middle_mcp, index_mcp, pinky_mcp) -> List[float]:
        hand_vector = np.array([middle_mcp.x - wrist.x, middle_mcp.y - wrist.y])
        hand_angle = np.arctan2(hand_vector[1], hand_vector[0])
        knuckle_width = self._distance(index_mcp, pinky_mcp)
        return [hand_angle, knuckle_width]
    
    def _compute_finger_straightness(self, finger_tips, mcps) -> List[float]:
        """
        Measuring tip-to-base distance as a proxy for finger straightness because bent fingers have their tips closer to their base than straight ones.
        """
        return [self._distance(tip, mcp) for tip, mcp in zip(finger_tips, mcps)]


class DatasetLoader:
    """Loads training images and extracts features."""
    
    def __init__(self, feature_extractor: HandLandmarkExtractor):
        self.feature_extractor = feature_extractor
    
    def load_from_directory(self, data_dir: Path) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """
        Scan directory structure and extract features from all images.
        
        I expect a directory structure of data_dir/class_name/session_name/*.jpg to support multiple capture sessions per class without data conflicts.
        """
        print("\nLoading raw data and extracting hand landmarks...")
        
        X = []
        y = []
        classes = []
        
        for key_dir in sorted(data_dir.iterdir()):
            if not key_dir.is_dir():
                continue
            
            key_name = key_dir.name
            if key_name not in classes:
                classes.append(key_name)
            class_idx = classes.index(key_name)
            
            print(f"\nProcessing {key_name}...")
            
            image_count, skipped = self._process_class_directory(
                key_dir, class_idx, X, y
            )
            
            print(f"  {key_name}: {image_count} samples (skipped {skipped} with no hands)")
        
        return np.array(X), np.array(y), classes
    
    def _process_class_directory(
            self,
            class_dir: Path,
            class_idx: int,
            X: List,
            y: List
        ) -> Tuple[int, int]:
        """Process all images in a class directory across multiple sessions."""
        image_count = 0
        skipped = 0
        
        for session_dir in class_dir.iterdir():
            if not session_dir.is_dir():
                continue
            
            images = list(session_dir.glob('*.jpg'))
            print(f"  Found {len(images)} images in {session_dir.name}")
            
            for img_file in images:
                features = self.feature_extractor.extract_from_image(img_file)
                
                if features is not None:
                    X.append(features)
                    y.append(class_idx)
                    image_count += 1
                else:
                    skipped += 1
                
                if (image_count + skipped) % 100 == 0:
                    print(f"  Processed {image_count + skipped} images...", end='\r')
        
        return image_count, skipped


class DatasetSplitter:
    """Splits dataset into train/validation/test sets."""
    
    def __init__(self, config: TrainingConfig):
        self.config = config
    
    def split(
        self,
        X: np.ndarray,
        y: np.ndarray,
        classes: List[str]
    ) -> DatasetSplit:
        """
        Create stratified train/val/test splits.
        
        I use stratified splitting to ensure each class is proportionally represented in all splits, preventing training bias toward over-represented classes.
        """
        X_train, X_temp, y_train, y_temp = train_test_split(
            X, y,
            test_size=self.config.test_size,
            random_state=self.config.random_state,
            stratify=y
        )
        
        X_val, X_test, y_val, y_test = train_test_split(
            X_temp, y_temp,
            test_size=self.config.val_size,
            random_state=self.config.random_state,
            stratify=y_temp
        )
        
        print(f"\nSplit: Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)}")
        
        return DatasetSplit(
            X_train=X_train,
            X_val=X_val,
            X_test=X_test,
            y_train=y_train,
            y_val=y_val,
            y_test=y_test,
            classes=classes
        )


class ModelTrainer:
    """Trains and evaluates Random Forest classifier."""
    
    def __init__(self, config: TrainingConfig):
        self.config = config
    
    def train(self, dataset: DatasetSplit) -> RandomForestClassifier:
        """
        Train a Random Forest classifier on landmark features.
        
        I use Random Forest rather than deep learning because landmark features are already high-level (not raw pixels), and RF trains faster with less data.
        """
        print("\nTraining Random Forest classifier...")
        
        model = RandomForestClassifier(
            n_estimators=self.config.n_estimators,
            max_depth=self.config.max_depth,
            random_state=self.config.random_state,
            n_jobs=-1
        )
        
        model.fit(dataset.X_train, dataset.y_train)
        
        return model


class ModelEvaluator:
    """Evaluates trained model performance."""
    
    def evaluate(
        self,
        model: RandomForestClassifier,
        dataset: DatasetSplit
    ) -> EvaluationMetrics:
        """
        Compute comprehensive evaluation metrics.
        
        I evaluate on train, val, and test to detect overfitting (train >> test) and help diagnose whether to collect more data or adjust model complexity.
        """
        train_pred = model.predict(dataset.X_train)
        val_pred = model.predict(dataset.X_val)
        test_pred = model.predict(dataset.X_test)
        
        train_acc = accuracy_score(dataset.y_train, train_pred) * 100
        val_acc = accuracy_score(dataset.y_val, val_pred) * 100
        test_acc = accuracy_score(dataset.y_test, test_pred) * 100
        
        per_class_metrics = self._compute_per_class_metrics(
            dataset.y_test,
            test_pred,
            dataset.classes
        )
        
        return EvaluationMetrics(
            train_accuracy=train_acc,
            val_accuracy=val_acc,
            test_accuracy=test_acc,
            per_class_metrics=per_class_metrics
        )
    
    def _compute_per_class_metrics(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        classes: List[str]
    ) -> Dict[str, Dict]:
        """
        Analyze performance for each class individually.
        
        Per-class metrics help identify which fingering positions are confused with each other, guiding data collection for poorly-performing classes.
        """
        metrics = {}
        
        for i, class_name in enumerate(classes):
            class_mask = y_true == i
            if class_mask.sum() == 0:
                continue
            
            class_acc = accuracy_score(y_true[class_mask], y_pred[class_mask]) * 100
            total = class_mask.sum()
            correct = (y_pred[class_mask] == y_true[class_mask]).sum()
            
            misclassifications = {}
            if correct < total:
                misclassified = y_pred[class_mask] != y_true[class_mask]
                wrong_preds = y_pred[class_mask][misclassified]
                for wrong_idx in np.unique(wrong_preds):
                    count = (wrong_preds == wrong_idx).sum()
                    misclassifications[classes[wrong_idx]] = count
            
            metrics[class_name] = {
                'accuracy': class_acc,
                'correct': correct,
                'total': total,
                'misclassifications': misclassifications
            }
        
        return metrics


class ModelPersistence:
    """Handles saving and loading trained models."""
    
    def __init__(self, models_dir: Path):
        self.models_dir = models_dir
        self.models_dir.mkdir(exist_ok=True)
    
    def save(
        self,
        model: RandomForestClassifier,
        classes: List[str],
        test_accuracy: float
    ) -> Path:
        """
        Serialize model and metadata to disk.
        
        I save the class list with the model because the model outputs class indices, and we need the mapping back to class names for inference.
        """
        model_path = self.models_dir / 'landmark_model.pkl'
        
        with open(model_path, 'wb') as f:
            pickle.dump({
                'model': model,
                'classes': classes,
                'test_acc': test_accuracy
            }, f)
        
        print(f"\nModel saved to: {model_path}")
        return model_path


class TrainingOrchestrator:
    """Coordinates the entire training pipeline."""
    
    def __init__(self, config: TrainingConfig):
        self.config = config
        self.feature_extractor = HandLandmarkExtractor()
        self.dataset_loader = DatasetLoader(self.feature_extractor)
        self.splitter = DatasetSplitter(config)
        self.trainer = ModelTrainer(config)
        self.evaluator = ModelEvaluator()
        self.persistence = ModelPersistence(project_root / 'trained_models')
    
    def run(self) -> Optional[Path]:
        """Execute the complete training workflow."""
        self._print_header()
        
        X, y, classes = self.dataset_loader.load_from_directory(self.config.raw_data_dir)
        
        if len(X) == 0:
            print("\nNo data found!")
            return None
        
        self._print_dataset_info(X, y, classes)
        
        dataset = self.splitter.split(X, y, classes)
        model = self.trainer.train(dataset)
        metrics = self.evaluator.evaluate(model, dataset)
        
        self._print_results(metrics)
        
        model_path = self.persistence.save(
            model,
            dataset.classes,
            metrics.test_accuracy
        )
        
        print("="*60 + "\n")
        return model_path
    
    @staticmethod
    def _print_header():
        print("\n" + "="*60)
        print("FluteVision Landmark-Based Training")
        print("="*60)
        print("Using MediaPipe landmarks as features (like sign language!)")
    
    @staticmethod
    def _print_dataset_info(X: np.ndarray, y: np.ndarray, classes: List[str]):
        print(f"\nDataset:")
        print(f"   Total samples: {len(X)}")
        print(f"   Classes: {classes}")
        print(f"   Features per sample: {X.shape[1]}")
    
    @staticmethod
    def _print_results(metrics: EvaluationMetrics):
        print(f"\nResults:")
        print(f"   Train Accuracy: {metrics.train_accuracy:.1f}%")
        print(f"   Val Accuracy: {metrics.val_accuracy:.1f}%")
        print(f"   Test Accuracy: {metrics.test_accuracy:.1f}%")
        
        print(f"\nPer-Class Test Accuracy:")
        print("="*60)
        
        for class_name, class_metrics in metrics.per_class_metrics.items():
            acc = class_metrics['accuracy']
            correct = class_metrics['correct']
            total = class_metrics['total']
            
            print(f"\n{class_name}:")
            print(f"   Accuracy: {acc:.1f}% ({correct}/{total} correct)")
            
            if class_metrics['misclassifications']:
                print(f"   Misclassifications:")
                for wrong_class, count in class_metrics['misclassifications'].items():
                    print(f"      -> Predicted as {wrong_class}: {count} times")
        
        print("\n" + "="*60)


def main():
    """Entry point for training script."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Train landmark-based flute classifier')
    parser.add_argument('--raw-dir', default='datasets/raw', help='Raw data directory')
    
    args = parser.parse_args()
    
    try:
        config = TrainingConfig(raw_data_dir=Path(args.raw_dir))
        orchestrator = TrainingOrchestrator(config)
        orchestrator.run()
    except KeyboardInterrupt:
        print("\nTraining interrupted")
        sys.exit(1)
    except Exception as e:
        print(f"\nTraining failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
