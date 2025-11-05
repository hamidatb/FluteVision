# FluteVision Runner - Quick Start Guide

## 🚀 How to Play

1. **Start the servers**:
```bash
# Terminal 1 - Backend
cd backend
python main.py

# Terminal 2 - Frontend  
cd frontend
python -m http.server 3000
```

2. **Open game**: http://localhost:3000/game.html

3. **Allow camera permissions**

4. **Click "Start Game"**

5. **Play!** Watch the target gesture and play it with your hands to jump!

## 🎮 Game Modes

### Random Mode (Default)
- endless runner style
- target gesture changes every 5 seconds
- gradually gets harder
- great for general practice

### Musical Test Mode
- play specific songs
- obstacles spawn at exact times matching the piece
- perfect for learning fingering sequences
- includes: Hot Cross Buns, Mary Had a Little Lamb, scales, arpeggios

## ⚙️ Settings (Click ⚙️ Button)

### Difficulty
- **Easy**: slower obstacles, more time between them
- **Medium**: balanced gameplay
- **Hard**: fast obstacles, close together

### Customization
- **Player Color**: change your character's color
- **Obstacle Color**: change obstacle color
- **Custom Player Image**: upload your own character sprite
- **Custom Background**: upload background image
- **Confidence Threshold**: how confident the model needs to be (default 70%)

### Mode Selection
- **Random**: endless mode with random gestures
- **Musical Test**: select a specific song to practice

## 🎵 Creating Custom Tests

### Method 1: Simple Format (Quick)
Open browser console (F12) and run:

```javascript
testLibrary.addTest(MusicalTest.fromSimpleFormat(
    'My Song',              // name
    'Practice exercise',    // description
    'C:0 D:1 E:2 F:3',     // notes (gesture:beat)
    120                     // tempo (BPM)
));
```

### Method 2: Precise Timing
```javascript
const myTest = new MusicalTest(
    'Custom Piece',
    'My composition',
    [
        {gesture: 'C', time: 0, duration: 500},      // time in ms
        {gesture: 'D', time: 500, duration: 500},
        {gesture: 'E', time: 1000, duration: 1000}
    ]
);

testLibrary.addTest(myTest);
```

### Method 3: JSON File (Future)
```json
{
    "name": "Twinkle Twinkle",
    "description": "Classic melody",
    "notes": [
        {"gesture": "C", "time": 0, "duration": 500},
        {"gesture": "C", "time": 500, "duration": 500}
    ]
}
```

Then load:
```javascript
await testLibrary.loadFromJson(jsonData);
```

## 🎯 Tips for High Scores

1. **Position hands clearly** in camera view
2. **Play gestures confidently** - higher confidence = more reliable jumps
3. **Watch the combo counter** - consecutive successful jumps increase score
4. **Practice in random mode** before trying musical tests
5. **Start with easy difficulty** to learn the gestures
6. **Use custom images** to make it fun!

## 📊 Scoring System

- **+1 point** for each obstacle avoided
- **Combo multiplier** for consecutive successes
- **High score** saved automatically
- **Game ends** when you hit an obstacle

## 🛠️ Architecture Highlights

### SOLID Principles Used:
- **S**ingle Responsibility: each class has one job
- **O**pen/Closed: easy to extend without modifying existing code
- **L**iskov Substitution: systems work with interfaces
- **I**nterface Segregation: small, focused interfaces
- **D**ependency Inversion: depends on abstractions

### Folder Structure:
```
game/
├── config/     - settings & constants
├── music/      - musical test system
├── assets/     - image loading
├── entities/   - player & obstacles
├── systems/    - collision, rendering
├── managers/   - score, input
├── core/       - game engine
└── ui/         - controllers, settings
```

## 🔮 Coming Soon

- MIDI file import
- More built-in songs
- Sound effects
- Multiplayer mode
- Power-ups
- Achievement system
- Practice mode (slow down songs)

## 🐛 Troubleshooting

**"Backend not ready"**
- make sure backend is running on port 8000
- check `http://localhost:8000/api/v1/health`

**"No gestures trained"**
- train the model first using the data capture tool
- need at least 2 gestures

**Camera not working**
- grant camera permissions
- try different browser (Chrome works best)
- make sure no other app is using camera

**Gestures not triggering jumps**
- check confidence threshold in settings
- make sure you're playing the correct target gesture
- improve lighting for better detection

**Game too hard/easy**
- adjust difficulty in settings
- change confidence threshold
- start with musical tests for easier timing

## 💡 Pro Tips

- **Learn the timing**: musical tests help you internalize the rhythm
- **Practice combos**: try to maintain long streaks
- **Customize visuals**: make it your own with custom images
- **Start slow**: begin with easy difficulty and simple scales
- **Use tests**: musical tests are better for focused practice than random mode

Enjoy playing! 🎵🎮

