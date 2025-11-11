# FluteVision 
https://github.com/user-attachments/assets/4be5468f-ab60-4c11-a026-c157530eaae9

## What is this?

So I play the flute, and I had this idea: what if my computer could recognize what note I'm playing just by looking at my hands, effectively helping me learn keys through gamifying the process? That's what this project does.

I point my webcam at my flute, play different notes, and the computer recognizes the fingering positions in real time. Then I turned it into a game where you have to play the right notes to jump over obstacles. It's like Guitar Hero but for flute, and instead of pressing buttons, you actually play your instrument.

## How it works (the simple version)

Here's the basic flow:
1. **Your webcam captures video** of your hands on the flute
2. **MediaPipe** detects all the landmarks on your hands (like where each finger joint is)
3. **My Python backend** extracts 120 numerical features from those landmarks (things like finger bend angles, spacing between fingers, thumb position, etc.)
4. **A Random Forest model** I trained looks at those features and predicts which note you're playing
5. **The frontend game** shows you what note to play next and updates your score

The whole round trip happens in about 100-200 milliseconds, so it feels pretty real-time.

## Try it live!

You can test it right now without installing anything:

**🎮 [Play FluteVision Live](https://flutevision-web-cd91d82764ea.herokuapp.com)**


**Two modes:**
- **Practice Mode**: Just see what notes you're playing, practice specific fingerings. This is useful for just seeing how my model genralizes to you, and figuring out if you need to change your lighting or positioning before you start playing the game.
- **Game Mode**: Play notes to jump over obstacles, rack up combos, try different themes (the Hamidat theme is my fav).

You'll need a webcam and good lighting. If you don't have a flute, you can also just use hand gestures (there's a "hand mode" that recognizes open/close gestures).

## Or run it locally

Want to run it on your own machine? Here's how:

### Prerequisites
- Python 3.11+
- Node.js 18+
- A webcam
- (Optional) A flute

### Backend Setup
```bash
cd backend

# make a virtual environment
python -m venv venv
source venv/bin/activate 

# install everything
pip install -r requirements.txt

# run it
python main.py
```

The API will be at `http://localhost:8000`. You can check out the auto-generated API docs at `http://localhost:8000/docs`.

### Frontend Setup
```bash
cd frontend

npm install

npm run dev
```

Now open `http://localhost:4321` (port depends on what you have running already) and you should see the game!

Make sure to update the API URL in `frontend/src/js/api/apiConfig.js` to point to your local backend.

## Training your own model

The coolest part is you can train the model on your own hands. The one I deployed is trained on my hands and my flute, so it might not work perfectly for you.

### Collect training data
```bash
source venv/bin/activate
cd backend

# note: mode can be flute or hand, depending on what you're currently updating
# take images for the notes you want to train
python ml/scripts/capture_data.py \
  --keys Bb C D Eb F G A \
  --samples 200 \
  --mode flute \
  --user your_name
```

This opens your webcam, shows you which note to play, counts down, then captures 200 images of your hands in that position. It does this for each note you specify. Read capture_data.py to understand the flags more 

### Train the model
```bash
python ml/scripts/train_landmark_model.py \
  --mode flute \
  --raw-dir ml/datasets/raw
```

This processes all those images, extracts hand landmarks, and trains a Random Forest classifier. Takes a few seconds-minutes depending on how much data you collected.  

### Test it
```bash
python ml/scripts/test_landmark_live.py --mode flute 
```

Opens your webcam and shows real-time predictions with confidence scores. Press Q to quit.

If you're happy with it, commit the new model file, and run on dev to test

## Tech stack

**Backend:**
- FastAPI (Python web framework)
- MediaPipe (hand landmark detection)
- OpenCV (image processing)
- scikit-learn (Random Forest classifier)
- Deployed on Heroku

**Frontend:**
- Astro (static site generator)
- Vanilla JavaScript (custom game engine, no frameworks)
- HTML5 Canvas (game rendering)
- MediaPipe in the browser (for the optional hand landmarks overlay bc I think it looks cool)
- Deployed on Heroku

**ML Pipeline:**
- Custom feature engineering (120 features per frame)
- Random Forest classifier (fast CPU inference, no GPU needed)
- Training scripts for easy model updates

**CI/CD:**
- GitHub Actions (auto-deploy)

## How the ML model actually works

Here's the detailed version if you're interested in the ML side of things.

### Step 1: MediaPipe gives me hand landmarks
MediaPipe detects 21 landmarks per hand (things like fingertips, knuckles, wrist, etc). For two hands, that's 42 points, each with x, y, and z coordinates. So technically 126 raw values.

But here's the thing: I can't just feed those raw coordinates into a classifier. Why? Because if I move slightly closer to the camera, all those coordinates change even though my fingering is the same. Or if I tilt my hand a bit, same problem. The model would think it's a different note.

### Step 2: Feature engineering (this is where it gets interesting)
So instead of using raw coordinates, I calculate 120 features that describe the hand pose in a way that doesn't care about camera distance, hand rotation, or exact position. Here's what I'm tracking:

**Finger bend levels (10 features):**
- For each finger (including thumb), I calculate how bent it is as a ratio. Basically: is the fingertip close to the base knuckle? This ratio stays the same whether you're close or far from the camera.
- I also track binary up/down state (is fingertip above or below the middle joint?) because some fingerings have sharp on/off states.

**Fingertip orientations (4 features):**
- The angle of each fingertip relative to your hand center. This way if you rotate your hand, the relative angles stay similar.

**Interfinger spacing (6 features):**
- Distance between finger pairs (index to middle, middle to ring, etc). Some flute notes need specific fingers spread apart.
- I measure both adjacent fingers and non-adjacent ones (like index to ring) because that extra context helps.

**Relative finger heights (4 features):**
- Which fingers are higher/lower than others, normalized to a 0-1 scale based on your current hand span. Handles different camera angles.

**Joint angles (4 features):**
- The actual angle at each finger's middle joint. I only use the PIP joints (the middle ones) because they're the most stable and less noisy than other joints.

**Thumb positioning (13 features):**
- This gets its own category because thumb position is CRITICAL for flute fingerings. I track thumb angle, distance from thumb to each other finger, and x/y offsets. The thumb is doing a lot of work.

**Hand orientation (2 features):**
- Overall hand angle and knuckle width. Just general hand pose context.

**Finger straightness (4 features):**
- How extended each finger is (tip to base distance). Bent fingers pull their tips closer to the base.

All these features are carefully designed to be **scale-invariant** (doesn't matter how far from camera) and **rotation-invariant** (doesn't matter if you tilt your hand a bit).

### Step 3: Training the Random Forest
Once I have those 120 features extracted from like 200 images per note, I train a Random Forest classifier with 100 trees and max depth of 10. Random Forest basically builds a bunch of decision trees that "vote" on what note you're playing.

The training split is 70% train, 10% validation, 20% test. I use stratified splitting so each split has a proportional representation of all the notes (don't want all the C's in one split and all the D's in another, that would be bad).

### Step 4: Real-time prediction
When you play a note:
1. Webcam captures frame
2. MediaPipe extracts the 21 landmarks per hand (takes ~20ms)
3. My feature extractor calculates those 120 features (takes ~5ms)
4. Random Forest predicts the note (takes ~2ms)
5. Send back the prediction with confidence scores

The whole backend processing is like 30-50ms. The rest of the latency is just network and video encoding.

### Why Random Forest instead of a neural network?
Good question! I actually tried a CNN first where I drew the hand landmarks on an image and trained it to recognize patterns. But it needed way more data and was slower. Random Forest works better here because:
- The MediaPipe landmarks are already high-level features (not raw pixels), so I don't need a neural network to learn feature extraction
- It trains on small datasets (100-200 samples per note). CNNs would need thousands.
- Inference is super fast on CPU (no GPU needed = cheaper hosting and works on anyone's machine)
- I can actually debug it by looking at feature importance (which features matter most for classification)
- The model file is tiny (like 2MB) compared to neural networks

Note though, the main errors come from transitioning between notes (when your fingers are mid-movement) or if the lighting is bad and MediaPipe can't see your hands clearly.

## Current limitations

- Only trained on my hands/flute (you'll want to retrain for best results)
- Lighting matters a lot (MediaPipe needs to see your hands clearly)
- No user accounts yet (scores don't persist)

## What's next?

Some ideas I'm thinking about:
- Add more songs for musical test mode
- User accounts and leaderboards
- Multiplayer mode?
- AI-generated practice exercises (because everything is #AI)

## Contributing

If you want to contribute, feel free to open a PR, issue, or contact me! The main areas that could use help:
- More musical test songs (in JSON format)
- UI/UX improvements (I am not the best UI dev out there)
- Documentation

## License

This is just a personal project for learning. If you build something cool with it, let me know! 

---

Built by me (Hamidat) while procrastinating on actual flute practice 😅

Questions? Found a bug? Open an issue or reach out!
