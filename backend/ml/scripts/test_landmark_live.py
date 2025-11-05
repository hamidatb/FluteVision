"""
Live testing with landmark-based model.
"""

import cv2
import pickle
import numpy as np
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

# ml is now inside backend folder
PROJECT_ROOT = Path(__file__).parent.parent.parent  # backend/
SCRIPTS_DIR = Path(__file__).parent

sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(SCRIPTS_DIR))

from config import MODEL_PATH
from ui_utils import PredictionUIRenderer

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    print("MediaPipe not available!")
    sys.exit(1)


@dataclass
class PredictionResult:
    """Container for prediction results."""
    predicted_class: str
    confidence: float
    all_probabilities: Dict[str, float]


class ModelLoader:
    """Loads and provides access to trained models."""
    
    def __init__(self, model_path: Path):
        self.model_path = model_path
        self.model = None
        self.classes = []
        self.metadata = {}
    
    def load(self) -> bool:
        """
        Load the pickled model and its metadata.
        
        I return a boolean rather than raising exceptions to give callers
        flexibility in how they handle missing models (show UI vs exit immediately).
        """
        if not self.model_path.exists():
            print(f"❌ Model not found at {self.model_path}")
            print("   Run: python scripts/train_landmark_model.py")
            return False
        
        with open(self.model_path, 'rb') as f:
            data = pickle.load(f)
            self.model = data['model']
            self.classes = data['classes']
            self.metadata = data
        
        print(f"   Model loaded!")
        print(f"   Classes: {self.classes}")
        print(f"   Test accuracy: {data['test_acc']:.1f}%\n")
        return True


class HandLandmarkExtractor:
    """Extracts numerical features from MediaPipe hand landmarks."""
    
    def __init__(self):
        """
        I keep this stateless rather than storing landmarks as instance variables to make it thread-safe for potential future parallelization. Shoutout OS fr.
        """
        self.expected_feature_count = 120
    
    def extract_features(self, hand_landmarks_list) -> Optional[np.ndarray]:
        """
        Convert raw MediaPipe landmarks into a feature vector.
        
        I extract 60 features per hand covering finger bends, angles, spacing, etc. This matches the training pipeline to ensure consistency between training and inference.
        """
        if not hand_landmarks_list:
            return None
        
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
            features.extend(self._compute_thumb_positioning(
                thumb_tip, thumb_cmc, thumb_tip, finger_tips
            ))
            features.extend(self._compute_hand_orientation(wrist, middle_mcp, index_mcp, pinky_mcp))
            features.extend(self._compute_finger_straightness(finger_tips, [index_mcp, middle_mcp, ring_mcp, pinky_mcp]))
        
        while len(features) < self.expected_feature_count:
            features.append(0.0)
        
        return np.array(features[:self.expected_feature_count])
    
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
        Use binary up/down state in addition to continuous bend level because some fingering patterns have sharp state transitions that are easier to detect this way.
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
        I compute angles relative to hand center rather than absolute screen coordinates
        to make features invariant to hand rotation.
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
        Measure both adjacent and non-adjacent finger distances because some notes require spreading specific fingers apart.
        """
        index_tip, middle_tip, ring_tip, pinky_tip = finger_tips
        finger_pairs = [
            (index_tip, middle_tip), (middle_tip, ring_tip), (ring_tip, pinky_tip),
            (index_tip, ring_tip), (index_tip, pinky_tip), (middle_tip, pinky_tip)
        ]
        return [self._distance(tip1, tip2) for tip1, tip2 in finger_pairs]
    
    def _compute_finger_height_relativity(self, finger_tips) -> List[float]:
        """
        I normalize heights to a 0-1 scale based on the current frame's min/max to handle varying camera angles and hand positions gracefully.
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
    
    def _compute_thumb_positioning(self, thumb_tip, thumb_cmc, thumb_actual_tip, finger_tips) -> List[float]:
        """
        I track thumb-to-finger distances separately because thumb position is critical for distinguishing many flute fingering patterns.
        """
        thumb_vector = np.array([thumb_actual_tip.x - thumb_cmc.x, thumb_actual_tip.y - thumb_cmc.y])
        thumb_angle = np.arctan2(thumb_vector[1], thumb_vector[0])
        
        features = [thumb_angle]
        for tip in finger_tips:
            features.extend([
                self._distance(thumb_actual_tip, tip),
                thumb_actual_tip.x - tip.x,
                thumb_actual_tip.y - tip.y,
            ])
        return features
    
    def _compute_hand_orientation(self, wrist, middle_mcp, index_mcp, pinky_mcp) -> List[float]:
        hand_vector = np.array([middle_mcp.x - wrist.x, middle_mcp.y - wrist.y])
        hand_angle = np.arctan2(hand_vector[1], hand_vector[0])
        knuckle_width = self._distance(index_mcp, pinky_mcp)
        return [hand_angle, knuckle_width]
    
    def _compute_finger_straightness(self, finger_tips, mcps) -> List[float]:
        """
        Using tip-to-base distance as a proxy for finger straightness bc bent fingers have their tips closer to their base than straight ones.
        """
        return [self._distance(tip, mcp) for tip, mcp in zip(finger_tips, mcps)]


class PredictionEngine:
    """Makes predictions using a loaded model."""
    
    def __init__(self, model, classes: List[str]):
        self.model = model
        self.classes = classes
    
    def predict(self, features: np.ndarray) -> PredictionResult:
        """
        Run inference and return structured prediction results.
        """
        prediction = self.model.predict([features])
        predicted_idx = int(prediction[0])
        predicted_key = self.classes[predicted_idx]
        
        probabilities = self.model.predict_proba([features])[0]
        confidence = probabilities[predicted_idx]
        
        all_probabilities = {
            class_name: probabilities[i]
            for i, class_name in enumerate(self.classes)
        }
        
        return PredictionResult(
            predicted_class=predicted_key,
            confidence=confidence,
            all_probabilities=all_probabilities
        )


class WebcamCapture:
    """Manages webcam capture and frame preprocessing."""
    
    def __init__(self, camera_index: int = 0):
        self.camera_index = camera_index
        self.cap = None
    
    def start(self) -> bool:
        """Initialize the webcam."""
        self.cap = cv2.VideoCapture(self.camera_index)
        if not self.cap.isOpened():
            print("❌ Could not open webcam!")
            return False
        print("Webcam started!")
        return True
    
    def read_frame(self) -> Optional[np.ndarray]:
        """
        Read and preprocess a frame from the webcam.
        
        Flip the frame horizontally to create a mirror effect because it's more intuitive for users (matching what they'd see in a real mirror).
        """
        if not self.cap:
            return None
        
        ret, frame = self.cap.read()
        if not ret:
            return None
        
        return cv2.flip(frame, 1)
    
    def release(self):
        """Clean up camera resources."""
        if self.cap:
            self.cap.release()


class HandLandmarkVisualizer:
    """Draws MediaPipe hand landmarks on frames."""
    
    def __init__(self):
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles
        self.mp_hands = mp.solutions.hands
    
    def draw_landmarks(self, frame: np.ndarray, hand_landmarks_list) -> np.ndarray:
        """
        Draw landmarks on every frame even if predictions are throttled to provide continuous visual feedback for hand positioning.
        """
        if not hand_landmarks_list:
            return frame
        
        for hand_landmarks in hand_landmarks_list:
            self.mp_drawing.draw_landmarks(
                frame,
                hand_landmarks,
                self.mp_hands.HAND_CONNECTIONS,
                self.mp_drawing_styles.get_default_hand_landmarks_style(),
                self.mp_drawing_styles.get_default_hand_connections_style()
            )
        
        return frame


class MediaPipeHandDetector:
    """Wraps MediaPipe hands detection."""
    
    def __init__(self):
        """
        Using static_image_mode=True and lower confidence threshold because it gives more stable detections for stationary flute fingering positions.
        """
        mp_hands = mp.solutions.hands
        self.hands = mp_hands.Hands(
            static_image_mode=True,
            max_num_hands=2,
            min_detection_confidence=0.3
        )
    
    def detect(self, frame: np.ndarray):
        """Detect hands in an RGB frame."""
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        return self.hands.process(frame_rgb)
    
    def close(self):
        """Release MediaPipe resources."""
        self.hands.close()


class LiveRecognitionOrchestrator:
    """Coordinates all components for live flute recognition."""
    
    def __init__(
        self,
        model_loader: ModelLoader,
        webcam: WebcamCapture,
        hand_detector: MediaPipeHandDetector,
        feature_extractor: HandLandmarkExtractor,
        ui_renderer: PredictionUIRenderer,
        landmark_visualizer: HandLandmarkVisualizer
        ):
        self.model_loader = model_loader
        self.webcam = webcam
        self.hand_detector = hand_detector
        self.feature_extractor = feature_extractor
        self.ui_renderer = ui_renderer
        self.landmark_visualizer = landmark_visualizer
        self.prediction_engine = None
    
    def run(self) -> int:
        """Execute the live recognition loop."""
        if not self.model_loader.load():
            return 1
        
        self.prediction_engine = PredictionEngine(
            self.model_loader.model,
            self.model_loader.classes
        )
        
        self.ui_renderer.classes = self.model_loader.classes
        
        if not self.webcam.start():
            return 1
        
        print("Position your hands and play different notes!\n")
        
        self._recognition_loop()
        
        self._cleanup()
        return 0
    
    def _recognition_loop(self):
        """
        Main processing loop.
        
        Process every single frame rather than skipping frames to ensure responsive real-time feedback even with fast hand movements.
        """
        while True:
            frame = self.webcam.read_frame()
            if frame is None:
                break
            
            results = self.hand_detector.detect(frame)
            
            prediction_result = None
            if results.multi_hand_landmarks:
                frame = self.landmark_visualizer.draw_landmarks(frame, results.multi_hand_landmarks)
                
                features = self.feature_extractor.extract_features(results.multi_hand_landmarks)
                if features is not None:
                    prediction_result = self.prediction_engine.predict(features)
            
            if prediction_result:
                self.ui_renderer.render_predictions(
                    frame,
                    predicted_class=prediction_result.predicted_class,
                    probabilities=prediction_result.all_probabilities
                )
            else:
                self.ui_renderer.render_predictions(frame)
            
            cv2.imshow('FluteVision Landmark Recognition', frame)
            
            if self._should_quit():
                print("\n👋 Quitting...")
                break
    
    @staticmethod
    def _should_quit() -> bool:
        key = cv2.waitKey(1) & 0xFF
        return key == ord('q') or key == ord('Q')
    
    def _cleanup(self):
        """Release all resources."""
        self.webcam.release()
        cv2.destroyAllWindows()
        self.hand_detector.close()
        print("Live recognition stopped!")


def print_header():
    """Display welcome banner."""
    print("\n" + "="*60)
    print("FluteVision Live Recognition")
    print("="*60)
    print("Using MediaPipe landmarks as features")
    print("Press 'Q' to quit")
    print("="*60 + "\n")


def main() -> int:
    """Entry point for live recognition."""
    print_header()
    
    model_loader = ModelLoader(MODEL_PATH)
    
    webcam = WebcamCapture(camera_index=0)
    hand_detector = MediaPipeHandDetector()
    feature_extractor = HandLandmarkExtractor()
    landmark_visualizer = HandLandmarkVisualizer()
    
    ui_renderer = PredictionUIRenderer(classes=[])
    
    orchestrator = LiveRecognitionOrchestrator(
        model_loader=model_loader,
        webcam=webcam,
        hand_detector=hand_detector,
        feature_extractor=feature_extractor,
        ui_renderer=ui_renderer,
        landmark_visualizer=landmark_visualizer
    )
    
    return orchestrator.run()


if __name__ == '__main__':
    sys.exit(main())
