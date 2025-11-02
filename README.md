# FluteVision: Vision-Based Flute Fingering Recognition System

I built this to recognize flute fingerings using computer vision. It's basically like sign language recognition but for flute hand positions. The system uses MediaPipe to track hand landmarks and a Random Forest classifier to identify which note you're playing.

It can recognize fingerings in real-time from your webcam, and you can collect your own training data to extend it to more notes.

## Quick Start

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

## Data Collection

### Capture Training Data

The capture tool will guide you through collecting training data. It shows you which key to play and walks you through the process:

```bash
# Capture data for multiple keys (recommended)
python scripts/capture_data.py --keys Bb C D --samples 300

# Capture for a single key
python scripts/capture_data.py --keys Bb --samples 200

# Capture with custom user ID
python scripts/capture_data.py --keys Bb C D --samples 300 --user session1

# Capture data and overwrite all previous images of that key
python scripts/capture_data.py --keys Bb C --samples 300 --replace
```

During capture, just position your hands showing the fingering and press `B` to start. The tool will count down 3-2-1 and then collect samples automatically. You'll see a progress bar while it's collecting. Repeat this for each key you want to train.

A few tips: capture in good lighting, keep your hands steady and visible, and try capturing multiple sessions with slight variations in hand position. Note that if you recapture a key, the old data gets automatically replaced.

## Model Training

Training uses MediaPipe to extract hand landmark coordinates (x,y positions) and trains a Random Forest classifier.

### Train the Model

```bash
# Train on all captured keys
python scripts/manage.py train --all
```

During training, it extracts hand landmarks from all your captured images, splits them into train/validation/test sets (70/20/10), and trains a Random Forest classifier. It'll show you accuracy metrics for each class and then save the model to `trained_models/landmark_model.pkl`.

**Expected output format:**
```
Results:
   Train Accuracy: 100.0%
   Val Accuracy: 99.5%
   Test Accuracy: 99.0%

Per-Class Test Accuracy:
Bb: 100.0% (39/39 correct)
C: 96.7% (29/30 correct)
D: 100.0% (30/30 correct)
```

## Live Testing

### Test with Live Webcam

```bash
python scripts/test_landmark_live.py
```

The live test shows your hand landmarks on screen and displays predictions in real-time. It processes every frame and shows confidence bars for each possible key. There's a prediction panel in the top-right corner that updates as you change fingerings.

Press `Q` to quit when you're done testing.

**Example output:**
```
============================================================
FluteVision Live Recognition (Landmark-Based)
============================================================
Model loaded!
   Classes: ['Bb', 'C', 'D']
   Test accuracy: 99.0%

[Live video shows hand landmarks with prediction panel showing:]
Key: Bb
Bb: ████████████ 95%
C:  ██           5%
D:               0%
```

## Workflow Summary

Here's the typical workflow I use:

```bash
# 1. Capture training data
python scripts/capture_data.py --keys Bb C D E F G A --samples 300

# 2. Train the model
python scripts/manage.py train --all

# 3. Test live recognition
python scripts/test_landmark_live.py
```

## How It Works

The system uses a landmark-based approach, similar to how sign language recognition works. Here's what happens:

1. MediaPipe tracks your hands and extracts 21 landmark points per hand
2. The x,y coordinates of those landmarks become features (84 values total for both hands)
3. A Random Forest classifier learns the patterns in hand positions to recognize fingerings
4. When you run the live test, it processes webcam frames and predicts fingerings in real-time

I went with this approach because it's position-invariant (doesn't matter where your hands are in the frame), it's fast, and it actually works really well. I'm getting around 99% test accuracy. It's also simpler than training a CNN from scratch, and it learns actual hand positions rather than getting confused by image artifacts.

## Project Structure

```
flutevision/
├── scripts/
│   ├── capture_data.py              # Interactive data collection
│   ├── train_landmark_model.py      # Landmark-based training
│   ├── test_landmark_live.py        # Live recognition
│   └── manage.py                    # CLI management
├── datasets/
│   └── raw/                         # Captured training images (this will vary depending on they keys you capture)
│       ├── Bb/
│       ├── C/
│       └── D/
├── trained_models/
│   └── landmark_model.pkl           # Trained Random Forest model
├── requirements.txt                 # Python dependencies
└── README.md
```

Per-class accuracy:
- Bb: 100%
- C: 96.7%
- D: 100%

## Tips for Best Results

For data collection, I've found it works best when you:
- Capture in consistent lighting
- Keep your hands fully visible
- Vary hand position slightly between captures (helps the model generalize)
- Capture at least 200-300 samples per key

When training, more data usually means better accuracy. I train on all keys.

For live recognition, make sure you have good lighting and keep your hands in frame. 

## Acknowledgments

This project uses MediaPipe for hand landmark detection, scikit-learn for the Random Forest classifier, and OpenCV for the computer vision.
