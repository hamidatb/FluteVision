"""
Train a flute fingering classifier using MediaPipe hand landmarks as features.

This approach uses the landmark COORDINATES directly (like sign language recognition)
instead of drawing them on images and using a CNN.
"""

import sys
import pickle
import numpy as np
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import cv2
import os

# suppress tensorflow/mediapipe warnings
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
    print("❌ MediaPipe not available!")
    sys.exit(1)


def extract_hand_landmarks(image_path):
    """
    extract detailed hand landmark features for precise flute fingering recognition
    
    captures subtle finger movements and relationships:
    - fine-grained finger tip positions and orientations
    - joint angles and finger curvature
    - finger spacing and relative heights
    - hand orientation and thumb positioning
    - multi-level finger bend detection
    
    returns:
        list of features or None if no hands detected
    """
    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands(
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
    
    features = []
    
    for hand_landmarks in results.multi_hand_landmarks:
        landmarks = hand_landmarks.landmark
        
        # get ALL finger landmarks for detailed analysis
        # thumb: tip(4), ip(3), mcp(2), cmc(1)
        # index: tip(8), dip(7), pip(6), mcp(5)
        # middle: tip(12), dip(11), pip(10), mcp(9)
        # ring: tip(16), dip(15), pip(14), mcp(13)
        # pinky: tip(20), dip(19), pip(18), mcp(17)
        # wrist: 0
        
        wrist = landmarks[0]
        thumb_tip, thumb_ip, thumb_mcp, thumb_cmc = landmarks[4], landmarks[3], landmarks[2], landmarks[1]
        index_tip, index_dip, index_pip, index_mcp = landmarks[8], landmarks[7], landmarks[6], landmarks[5]
        middle_tip, middle_dip, middle_pip, middle_mcp = landmarks[12], landmarks[11], landmarks[10], landmarks[9]
        ring_tip, ring_dip, ring_pip, ring_mcp = landmarks[16], landmarks[15], landmarks[14], landmarks[13]
        pinky_tip, pinky_dip, pinky_pip, pinky_mcp = landmarks[20], landmarks[19], landmarks[18], landmarks[17]
        
        def distance(p1, p2):
            return ((p1.x - p2.x)**2 + (p1.y - p2.y)**2)**0.5
        
        def angle_between_vectors(v1, v2):
            """calculate angle between two vectors in radians."""
            cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
            cos_angle = np.clip(cos_angle, -1.0, 1.0)  # prevent numerical errors
            return np.arccos(cos_angle)
        
        # robust finger bend analysis for live video stability
        def finger_bend_level(tip, dip, pip, mcp):
            """calculate how bent a finger is (0=straight, 1=fully bent)."""
            tip_to_mcp = distance(tip, mcp)
            pip_to_mcp = distance(pip, mcp)
            if pip_to_mcp > 0:
                return max(0, 1 - (tip_to_mcp / pip_to_mcp))
            return 0
        
        # Also add simple binary bend (more robust for live)
        def is_finger_down(tip, pip):
            return 1.0 if tip.y > pip.y else 0.0
        
        features.extend([
            # Continuous bend level (detailed)
            finger_bend_level(index_tip, index_dip, index_pip, index_mcp),
            finger_bend_level(middle_tip, middle_dip, middle_pip, middle_mcp),
            finger_bend_level(ring_tip, ring_dip, ring_pip, ring_mcp),
            finger_bend_level(pinky_tip, pinky_dip, pinky_pip, pinky_mcp),
            finger_bend_level(thumb_tip, thumb_ip, thumb_mcp, thumb_cmc),
            # Binary bend (robust)
            is_finger_down(index_tip, index_pip),
            is_finger_down(middle_tip, middle_pip),
            is_finger_down(ring_tip, ring_pip),
            is_finger_down(pinky_tip, pinky_pip),
            is_finger_down(thumb_tip, thumb_ip),
        ])
        
        # 2. FINGER TIP ORIENTATIONS AND ANGLES
        # Calculate finger tip directions relative to hand orientation
        hand_center = np.array([(wrist.x + middle_mcp.x) / 2, (wrist.y + middle_mcp.y) / 2])
        
        finger_tips = [index_tip, middle_tip, ring_tip, pinky_tip]
        for tip in finger_tips:
            # Vector from hand center to finger tip
            tip_vector = np.array([tip.x - hand_center[0], tip.y - hand_center[1]])
            # Angle of finger tip relative to hand center
            tip_angle = np.arctan2(tip_vector[1], tip_vector[0])
            features.append(tip_angle)
        
        # 3. INTER-FINGER SPACING AND RELATIVE POSITIONS
        # Detailed spacing between all finger pairs
        finger_pairs = [
            (index_tip, middle_tip), (middle_tip, ring_tip), (ring_tip, pinky_tip),
            (index_tip, ring_tip), (index_tip, pinky_tip), (middle_tip, pinky_tip)
        ]
        
        for tip1, tip2 in finger_pairs:
            features.append(distance(tip1, tip2))
        
        # 4. FINGER HEIGHT RELATIVITY (more detailed)
        finger_heights = [index_tip.y, middle_tip.y, ring_tip.y, pinky_tip.y]
        min_height = min(finger_heights)
        max_height = max(finger_heights)
        hand_span = max_height - min_height
        
        if hand_span > 0:
            for height in finger_heights:
                features.append((height - min_height) / hand_span)
        else:
            features.extend([0.5, 0.5, 0.5, 0.5])
        
        # 5. SIMPLIFIED JOINT ANGLE ANALYSIS
        # Only PIP angles (most stable and important for flute fingering)
        def joint_angle(p1, p2, p3):
            """Calculate angle at joint p2 formed by p1-p2-p3."""
            v1 = np.array([p1.x - p2.x, p1.y - p2.y])
            v2 = np.array([p3.x - p2.x, p3.y - p2.y])
            return angle_between_vectors(v1, v2)
        
        # Only PIP angles (most important for hole coverage)
        features.extend([
            joint_angle(index_mcp, index_pip, index_dip),
            joint_angle(middle_mcp, middle_pip, middle_dip),
            joint_angle(ring_mcp, ring_pip, ring_dip),
            joint_angle(pinky_mcp, pinky_pip, pinky_dip),
        ])
        
        # 6. THUMB POSITIONING AND ORIENTATION
        # Detailed thumb analysis
        thumb_vector = np.array([thumb_tip.x - thumb_cmc.x, thumb_tip.y - thumb_cmc.y])
        thumb_angle = np.arctan2(thumb_vector[1], thumb_vector[0])
        features.append(thumb_angle)
        
        # Thumb relative to each finger
        for tip in finger_tips:
            features.extend([
                distance(thumb_tip, tip),
                thumb_tip.x - tip.x,  # Thumb left/right of finger
                thumb_tip.y - tip.y,  # Thumb above/below finger
            ])
        
        # 7. HAND ORIENTATION AND SHAPE
        # Hand orientation vector
        hand_vector = np.array([middle_mcp.x - wrist.x, middle_mcp.y - wrist.y])
        hand_angle = np.arctan2(hand_vector[1], hand_vector[0])
        features.append(hand_angle)
        
        # Hand width (span across knuckles)
        hand_width = distance(index_mcp, pinky_mcp)
        features.append(hand_width)
        
        # 8. FINGER STRAIGHTNESS (stable feature)
        # How straight each finger is
        for tip, mcp in zip(finger_tips, [index_mcp, middle_mcp, ring_mcp, pinky_mcp]):
            features.append(distance(tip, mcp))
    
    # Balanced feature count: detailed but not too noisy
    # Ensure exactly 120 features (2 hands × 60 features each)
    while len(features) < 120:
        features.append(0.0)
    
    return features[:120]  # Balanced: detailed angles + robust basics


def load_dataset(raw_data_dir):
    """Load all images and extract landmark features."""
    print("\n📁 Loading raw data and extracting hand landmarks...")
    
    raw_path = Path(raw_data_dir)
    
    X = []  # Features (hand landmarks)
    y = []  # Labels (key names)
    classes = []
    
    for key_dir in sorted(raw_path.iterdir()):
        if key_dir.is_dir():
            key_name = key_dir.name
            if key_name not in classes:
                classes.append(key_name)
            class_idx = classes.index(key_name)
            
            print(f"\n📝 Processing {key_name}...")
            
            # Find all images in all session directories
            image_count = 0
            skipped = 0
            
            for session_dir in key_dir.iterdir():
                if session_dir.is_dir():
                    images = list(session_dir.glob('*.jpg'))
                    print(f"  Found {len(images)} images in {session_dir.name}")
                    
                    for img_file in images:
                        landmarks = extract_hand_landmarks(img_file)
                        
                        if landmarks is not None:
                            X.append(landmarks)
                            y.append(class_idx)
                            image_count += 1
                        else:
                            skipped += 1
                        
                        if (image_count + skipped) % 100 == 0:
                            print(f"  Processed {image_count + skipped}/{len(images)} images...", end='\r')
            
            print(f"  ✅ {key_name}: {image_count} samples (skipped {skipped} with no hands)")
    
    return np.array(X), np.array(y), classes


def train_model(raw_data_dir='datasets/raw'):
    """Train a Random Forest classifier on hand landmark features."""
    print("\n" + "="*60)
    print("🎶 FluteVision Landmark-Based Training")
    print("="*60)
    print("Using MediaPipe landmarks as features (like sign language!)")
    
    # Load dataset
    X, y, classes = load_dataset(raw_data_dir)
    
    if len(X) == 0:
        print("\n❌ No data found!")
        return None
    
    print(f"\n📊 Dataset:")
    print(f"   Total samples: {len(X)}")
    print(f"   Classes: {classes}")
    print(f"   Features per sample: {X.shape[1]}")
    
    # Split data
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.3, random_state=42, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.33, random_state=42, stratify=y_temp
    )
    
    print(f"\n📊 Split: Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)}")
    
    # Train Random Forest
    print("\n🌳 Training Random Forest classifier...")
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    train_pred = model.predict(X_train)
    val_pred = model.predict(X_val)
    test_pred = model.predict(X_test)
    
    train_acc = accuracy_score(y_train, train_pred) * 100
    val_acc = accuracy_score(y_val, val_pred) * 100
    test_acc = accuracy_score(y_test, test_pred) * 100
    
    print(f"\n📊 Results:")
    print(f"   Train Accuracy: {train_acc:.1f}%")
    print(f"   Val Accuracy: {val_acc:.1f}%")
    print(f"   Test Accuracy: {test_acc:.1f}%")
    
    # Detailed per-class analysis
    print(f"\n📊 Per-Class Test Accuracy:")
    print("="*60)
    for i, class_name in enumerate(classes):
        class_mask = y_test == i
        if class_mask.sum() > 0:
            class_acc = accuracy_score(y_test[class_mask], test_pred[class_mask]) * 100
            total = class_mask.sum()
            correct = (test_pred[class_mask] == y_test[class_mask]).sum()
            
            print(f"\n{class_name}:")
            print(f"   Accuracy: {class_acc:.1f}% ({correct}/{total} correct)")
            
            # Show what it was misclassified as
            if correct < total:
                misclassified = test_pred[class_mask] != y_test[class_mask]
                wrong_preds = test_pred[class_mask][misclassified]
                print(f"   Misclassifications:")
                for wrong_class_idx in np.unique(wrong_preds):
                    count = (wrong_preds == wrong_class_idx).sum()
                    wrong_class_name = classes[wrong_class_idx]
                    print(f"      → Predicted as {wrong_class_name}: {count} times")
    
    print("\n" + "="*60)
    
    # Save model
    models_dir = project_root / 'trained_models'
    models_dir.mkdir(exist_ok=True)
    
    model_path = models_dir / 'landmark_model.pkl'
    
    with open(model_path, 'wb') as f:
        pickle.dump({
            'model': model,
            'classes': classes,
            'test_acc': test_acc
        }, f)
    
    print(f"\n💾 Model saved to: {model_path}")
    print("="*60 + "\n")
    
    return model_path


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Train landmark-based flute classifier')
    parser.add_argument('--raw-dir', default='datasets/raw', help='Raw data directory')
    
    args = parser.parse_args()
    
    try:
        train_model(args.raw_dir)
    except KeyboardInterrupt:
        print("\n⚠️  Training interrupted")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Training failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

