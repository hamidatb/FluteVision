import { gameSettings } from '../../game/config/GameSettings';

// bridges prediction system to game input
// separated bc input can come from different sources (gestures, keyboard for testing, etc)
export class InputManager {
    constructor(camera) {
        this.camera = camera;
        this.currentPrediction = null;
        this.targetGesture = null;
        this.onCorrectInput = null;
        this.isMonitoring = false;
        
        // cooldown to prevent double-triggering from same gesture
        this.lastTriggerTime = 0;
        this.triggerCooldown = 300; // ms between allowed triggers
        
        // add keyboard support for testing bc it's easier to debug without needing perfect gestures
        this._setupKeyboardInput();
    }
    
    _setupKeyboardInput() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.isMonitoring) {
                e.preventDefault();
                
                // respect cooldown for keyboard too to prevent spam
                const now = Date.now();
                if (now - this.lastTriggerTime < this.triggerCooldown) {
                    return;
                }
                
                // trigger jump via callback, simulating a perfect gesture match
                if (this.onCorrectInput) {
                    this.lastTriggerTime = now;
                    this.onCorrectInput('keyboard', 1.0);
                }
            }
        });
    }
    
    startMonitoring(onPredictionUpdate) {
        this.isMonitoring = true;
        
        this.camera.startStreaming((prediction) => {
            this.currentPrediction = prediction;
            
            if (onPredictionUpdate) {
                onPredictionUpdate(prediction);
            }
            
            this._checkInput(prediction);
        });
    }
    
    stopMonitoring() {
        this.isMonitoring = false;
        this.camera.stopStreaming();
    }
    
    setTargetGesture(gesture) {
        this.targetGesture = gesture;
        // reset cooldown when target changes so player can immediately respond to new note
        this.lastTriggerTime = 0;
    }
    
    getCurrentPrediction() {
        return this.currentPrediction;
    }
    
    _checkInput(prediction) {
        if (!prediction.success) return;
        if (!this.targetGesture) return;
        if (!this.onCorrectInput) return;
        
        const threshold = gameSettings.get('confidenceThreshold');
        // debugging
        if (prediction.gesture === this.targetGesture) {
            const meetsThreshold = prediction.confidence >= threshold;
            console.log(meetsThreshold ? 'JUMP!' : '⚠️ TOO LOW CONFIDENCE TO JUMP:', {
                gesture: prediction.gesture,
                confidence: prediction.confidence.toFixed(3),
                threshold: threshold,
                diff: (prediction.confidence - threshold).toFixed(3)
            });
        }
        
        // check cooldown to prevent double-triggering
        const now = Date.now();
        const timeSinceLastTrigger = now - this.lastTriggerTime;
        if (timeSinceLastTrigger < this.triggerCooldown) {
            if (prediction.gesture === this.targetGesture && prediction.confidence >= threshold) {
                console.log(`JUMP COOLDOWN: ${timeSinceLastTrigger}ms since last trigger`);
            }
            return;
        }
        
        // correct gesture with high confidence triggers action
        if (prediction.gesture === this.targetGesture && 
            prediction.confidence >= threshold) {
            //console.log('✅ JUMP TRIGGERED!');
            this.lastTriggerTime = now;
            this.onCorrectInput(prediction.gesture, prediction.confidence);
        }
    }
}

