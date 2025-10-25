"""
Live testing with landmark-based model (like sign language recognition).
"""

import cv2
import pickle
import numpy as np
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    print("❌ MediaPipe not available!")
    sys.exit(1)


def main():
    print("\n" + "="*60)
    print("🎶 FluteVision Live Recognition (Landmark-Based)")
    print("="*60)
    print("Using MediaPipe landmarks as features (like sign language!)")
    print("Press 'Q' to quit")
    print("="*60 + "\n")
    
    # load trained model
    model_path = project_root / 'trained_models' / 'landmark_model.pkl'
    
    if not model_path.exists():
        print(f"❌ Model not found at {model_path}")
        print("   Run: python scripts/train_landmark_model.py")
        return 1
    
    with open(model_path, 'rb') as f:
        data = pickle.load(f)
        model = data['model']
        classes = data['classes']
    
    print(f"✅ Model loaded!")
    print(f"   Classes: {classes}")
    print(f"   Test accuracy: {data['test_acc']:.1f}%\n")
    
    # initialize mediapipe with same settings as training for consistency
    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands(
        static_image_mode=True,        
        max_num_hands=2,
        min_detection_confidence=0.3   
    )

    mp_drawing = mp.solutions.drawing_utils
    mp_drawing_styles = mp.solutions.drawing_styles
    
    # initialize webcam
    cap = cv2.VideoCapture(0) 
    if not cap.isOpened():
        print("❌ Could not open webcam!")
        return 1
    
    print("✅ Webcam started!")
    print("Position your hands and play different notes!\n")
    
    frame_count = 0
    predicted_key = "---"
    confidence = 0.0
    all_probabilities = {key: 0.0 for key in classes}
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_count += 1
        frame = cv2.flip(frame, 1)  # mirror for user comfort like data collection
        
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(frame_rgb)
        
        # process every frame for smooth prediction
        if results.multi_hand_landmarks:
            # extract same features as training for consistency
            features = []
            
            for hand_landmarks in results.multi_hand_landmarks:
                landmarks = hand_landmarks.landmark
                
                # Get ALL finger landmarks for detailed analysis
                wrist = landmarks[0]
                thumb_tip, thumb_ip, thumb_mcp, thumb_cmc = landmarks[4], landmarks[3], landmarks[2], landmarks[1]
                index_tip, index_dip, index_pip, index_mcp = landmarks[8], landmarks[7], landmarks[6], landmarks[5]
                middle_tip, middle_dip, middle_pip, middle_mcp = landmarks[12], landmarks[11], landmarks[10], landmarks[9]
                ring_tip, ring_dip, ring_pip, ring_mcp = landmarks[16], landmarks[15], landmarks[14], landmarks[13]
                pinky_tip, pinky_dip, pinky_pip, pinky_mcp = landmarks[20], landmarks[19], landmarks[18], landmarks[17]
                
                def distance(p1, p2):
                    return ((p1.x - p2.x)**2 + (p1.y - p2.y)**2)**0.5
                
                def angle_between_vectors(v1, v2):
                    cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
                    cos_angle = np.clip(cos_angle, -1.0, 1.0)
                    return np.arccos(cos_angle)
                
                # 1. ROBUST FINGER BEND ANALYSIS
                def finger_bend_level(tip, dip, pip, mcp):
                    tip_to_mcp = distance(tip, mcp)
                    pip_to_mcp = distance(pip, mcp)
                    if pip_to_mcp > 0:
                        return max(0, 1 - (tip_to_mcp / pip_to_mcp))
                    return 0
                
                def is_finger_down(tip, pip):
                    return 1.0 if tip.y > pip.y else 0.0
                
                features.extend([
                    # Continuous bend level
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
                
                # 2. FINGER TIP ORIENTATIONS
                hand_center = np.array([(wrist.x + middle_mcp.x) / 2, (wrist.y + middle_mcp.y) / 2])
                finger_tips = [index_tip, middle_tip, ring_tip, pinky_tip]
                for tip in finger_tips:
                    tip_vector = np.array([tip.x - hand_center[0], tip.y - hand_center[1]])
                    tip_angle = np.arctan2(tip_vector[1], tip_vector[0])
                    features.append(tip_angle)
                
                # 3. INTER-FINGER SPACING
                finger_pairs = [
                    (index_tip, middle_tip), (middle_tip, ring_tip), (ring_tip, pinky_tip),
                    (index_tip, ring_tip), (index_tip, pinky_tip), (middle_tip, pinky_tip)
                ]
                for tip1, tip2 in finger_pairs:
                    features.append(distance(tip1, tip2))
                
                # 4. FINGER HEIGHT RELATIVITY
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
                def joint_angle(p1, p2, p3):
                    v1 = np.array([p1.x - p2.x, p1.y - p2.y])
                    v2 = np.array([p3.x - p2.x, p3.y - p2.y])
                    return angle_between_vectors(v1, v2)
                
                # Only PIP angles (most stable)
                features.extend([
                    joint_angle(index_mcp, index_pip, index_dip),
                    joint_angle(middle_mcp, middle_pip, middle_dip),
                    joint_angle(ring_mcp, ring_pip, ring_dip),
                    joint_angle(pinky_mcp, pinky_pip, pinky_dip),
                ])
                
                # 6. THUMB POSITIONING
                thumb_vector = np.array([thumb_tip.x - thumb_cmc.x, thumb_tip.y - thumb_cmc.y])
                thumb_angle = np.arctan2(thumb_vector[1], thumb_vector[0])
                features.append(thumb_angle)
                
                for tip in finger_tips:
                    features.extend([
                        distance(thumb_tip, tip),
                        thumb_tip.x - tip.x,
                        thumb_tip.y - tip.y,
                    ])
                
                # 7. HAND ORIENTATION AND SHAPE
                hand_vector = np.array([middle_mcp.x - wrist.x, middle_mcp.y - wrist.y])
                hand_angle = np.arctan2(hand_vector[1], hand_vector[0])
                features.append(hand_angle)
                features.append(distance(index_mcp, pinky_mcp))
                
                # 8. FINGER STRAIGHTNESS
                for tip, mcp in zip(finger_tips, [index_mcp, middle_mcp, ring_mcp, pinky_mcp]):
                    features.append(distance(tip, mcp))
                
                # Draw landmarks
                mp_drawing.draw_landmarks(
                    frame,
                    hand_landmarks,
                    mp.solutions.hands.HAND_CONNECTIONS,
                    mp_drawing_styles.get_default_hand_landmarks_style(),
                    mp_drawing_styles.get_default_hand_connections_style()
                )
            
            # Ensure exactly 120 features (2 hands × 60 features each)
            while len(features) < 120:
                features.append(0.0)
            features = features[:120]
            
            prediction = model.predict([np.array(features)])
            predicted_idx = int(prediction[0])
            predicted_key = classes[predicted_idx]
            
            # Get all probabilities
            probabilities = model.predict_proba([np.array(features)])[0]
            confidence = probabilities[predicted_idx]
            
            # Store all probabilities for display
            for i, class_name in enumerate(classes):
                all_probabilities[class_name] = probabilities[i]
        else:
            # No hands detected
            predicted_key = "---"
            confidence = 0.0
            all_probabilities = {key: 0.0 for key in classes}
        
        # Display prediction in TOP-RIGHT corner
        h, w = frame.shape[:2]
        
        # Panel dimensions
        panel_width = 250
        panel_x = w - panel_width - 10
        panel_height = 60 + len(classes) * 30
        
        # Main panel background
        cv2.rectangle(frame, (panel_x, 10), (w - 10, 10 + panel_height), (0, 0, 0), -1)
        cv2.rectangle(frame, (panel_x, 10), (w - 10, 10 + panel_height), (0, 255, 255), 2)
        
        # Predicted key (large)
        cv2.putText(frame, f"Key: {predicted_key}", 
                   (panel_x + 10, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        
        # Confidence bars
        y_offset = 65
        bar_width = panel_width - 100
        
        for class_name in classes:
            prob = all_probabilities[class_name]
            
            # Color based on probability
            if prob > 0.7:
                color = (0, 255, 0)  # green
            elif prob > 0.4:
                color = (0, 255, 255)  # yellow
            else:
                color = (100, 100, 100)  # gray
            
            # Label
            cv2.putText(frame, f"{class_name}:", 
                       (panel_x + 10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            # Background bar
            bar_x = panel_x + 50
            cv2.rectangle(frame, (bar_x, y_offset - 10), (bar_x + bar_width, y_offset - 2), (50, 50, 50), -1)
            
            # Probability bar
            filled_width = int(prob * bar_width)
            if filled_width > 0:
                cv2.rectangle(frame, (bar_x, y_offset - 10), (bar_x + filled_width, y_offset - 2), color, -1)
            
            # Percentage text
            cv2.putText(frame, f"{prob:.0%}", 
                       (bar_x + bar_width + 5, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
            
            y_offset += 30
        
        cv2.imshow('FluteVision Landmark Recognition', frame)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q') or key == ord('Q'):
            print("\n👋 Quitting...")
            break
    
    cap.release()
    cv2.destroyAllWindows()
    hands.close()
    
    print("✅ Live recognition stopped!")
    return 0


if __name__ == '__main__':
    sys.exit(main())

