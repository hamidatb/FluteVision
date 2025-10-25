# 🎶 FluteVision: Vision-Based Flute Fingering Recognition System

A landmark-based machine learning system for recognizing flute fingerings using MediaPipe hand tracking (similar to sign language recognition).

## 🌟 Features

- **Real-time Flute Fingering Recognition**: Landmark-based model using hand coordinates as features
- **MediaPipe Hand Tracking**: Extracts precise hand landmark positions (x,y coordinates)
- **Random Forest Classifier**: Fast, accurate classification (99% test accuracy)
- **Interactive Data Collection**: Easy-to-use webcam capture with visual feedback
- **Live Recognition**: Real-time predictions with confidence bars
- **User-Extendable**: Capture your own data and retrain the model

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- OpenCV
- MediaPipe
- scikit-learn
- Webcam

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/flutevision.git
   cd flutevision
   ```

2. **Create virtual environment and install dependencies**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

## 📊 Data Collection

### Capture Training Data

The interactive capture tool shows you which key to play and guides you through the process:

```bash
# Capture data for multiple keys (recommended)
python scripts/capture_data.py --keys Bb C D --samples 300

# Capture for a single key
python scripts/capture_data.py --keys Bb --samples 200

# Capture with custom user ID
python scripts/capture_data.py --keys Bb C D --samples 300 --user session1
```

**During capture:**
- Position your hands showing the fingering
- Press `B` to begin capturing
- The tool will count down 3-2-1 and then collect samples automatically
- Progress bar shows collection status
- Repeat for each key

**Tips for best results:**
- Capture in good lighting
- Keep hands steady and visible
- Capture multiple sessions with slight variations in hand position
- Old data is automatically replaced when you recapture a key

## 🤖 Model Training

Training uses MediaPipe to extract hand landmark coordinates (x,y positions) and trains a Random Forest classifier.

### Train the Model

```bash
# Train on all captured keys
python scripts/manage.py train --all
```

**What happens during training:**
- Extracts hand landmarks from all images
- Creates train/validation/test splits (70/20/10)
- Trains Random Forest classifier
- Shows detailed accuracy metrics per class
- Saves model to `trained_models/landmark_model.pkl`

**Expected output:**
```
📊 Results:
   Train Accuracy: 100.0%
   Val Accuracy: 99.5%
   Test Accuracy: 99.0%

📊 Per-Class Test Accuracy:
Bb: 100.0% (39/39 correct)
C: 96.7% (29/30 correct)
D: 100.0% (30/30 correct)
```

## 🎥 Live Testing

### Test with Live Webcam

```bash
python scripts/test_landmark_live.py
```

**Features:**
- ✅ **Smooth real-time recognition** - processes every frame
- 🎹 **Live key prediction** - see what note you're playing
- 📊 **Confidence bars** - see probability for all keys
- ✨ **Hand landmark visualization** - see MediaPipe tracking
- 🎨 **Clean UI** - prediction panel in top-right corner

**Controls:**
- Press `Q` to quit
- Predictions update in real-time as you change fingerings

**Example:**
```
============================================================
🎶 FluteVision Live Recognition (Landmark-Based)
============================================================
✅ Model loaded!
   Classes: ['Bb', 'C', 'D']
   Test accuracy: 99.0%

[Live video shows hand landmarks with prediction panel showing:]
Key: Bb
Bb: ████████████ 95%
C:  ██           5%
D:               0%
```

## 🔧 Workflow Summary

**Complete workflow from start to finish:**

```bash
# 1. Capture training data
python scripts/capture_data.py --keys Bb C D E F G A --samples 300

# 2. Train the model
python scripts/manage.py train --all

# 3. Test live recognition
python scripts/test_landmark_live.py
```

## 💡 How It Works

FluteVision uses a **landmark-based approach** similar to sign language recognition:

1. **MediaPipe Hand Tracking**: Detects hands and extracts 21 landmark points per hand
2. **Feature Extraction**: Uses x,y coordinates of landmarks as numerical features (84 values total)
3. **Random Forest Classifier**: Learns patterns in hand positions to recognize fingerings
4. **Real-time Prediction**: Processes webcam frames and predicts fingerings instantly

**Why this approach works:**
- ✅ Position-invariant (works regardless of where hands are in frame)
- ✅ Fast (Random Forest is very quick)
- ✅ Accurate (99% test accuracy)
- ✅ Simple (no complex CNN training needed)
- ✅ Robust (learns actual hand positions, not image artifacts)

## 📁 Project Structure

```
flutevision/
├── scripts/
│   ├── capture_data.py              # Interactive data collection
│   ├── train_landmark_model.py      # Landmark-based training
│   ├── test_landmark_live.py        # Live recognition
│   └── manage.py                    # CLI management
├── datasets/
│   └── raw/                         # Captured training images
│       ├── Bb/
│       ├── C/
│       └── D/
├── trained_models/
│   └── landmark_model.pkl           # Trained Random Forest model
├── requirements.txt                 # Python dependencies
└── README.md
```

## 📈 Performance

**Current Results (3 keys: Bb, C, D):**
- **Test Accuracy**: 99.0%
- **Training Time**: ~10 seconds
- **Inference Speed**: Real-time (30+ FPS)
- **Model Size**: ~500KB

**Per-Class Accuracy:**
- Bb: 100%
- C: 96.7%
- D: 100%

## 🎯 Tips for Best Results

1. **Data Collection:**
   - Capture in consistent lighting
   - Keep hands fully visible
   - Vary hand position slightly between captures
   - Capture 200-300 samples per key minimum

2. **Training:**
   - More data = better accuracy
   - Train on all keys together for best results
   - Retrain if you add new keys

3. **Live Recognition:**
   - Ensure good lighting
   - Keep hands in frame
   - Hold fingering steady for stable predictions

## 🙏 Acknowledgments

- **MediaPipe** for hand landmark detection
- **scikit-learn** for Random Forest classifier
- **OpenCV** for computer vision

---

**FluteVision** - Making flute learning more accessible through AI! 🎶✨
