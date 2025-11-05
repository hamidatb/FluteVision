// bridges prediction system to game input
// separated bc input can come from different sources (gestures, keyboard for testing, etc)
class InputManager {
    constructor(camera) {
        this.camera = camera;
        this.currentPrediction = null;
        this.targetGesture = null;
        this.onCorrectInput = null;
        this.isMonitoring = false;
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
    }
    
    getCurrentPrediction() {
        return this.currentPrediction;
    }
    
    _checkInput(prediction) {
        if (!prediction.success) return;
        if (!this.targetGesture) return;
        if (!this.onCorrectInput) return;
        
        const threshold = gameSettings.get('confidenceThreshold');
        
        // correct gesture with high confidence triggers action
        if (prediction.gesture === this.targetGesture && 
            prediction.confidence >= threshold) {
            this.onCorrectInput(prediction.gesture, prediction.confidence);
        }
    }
}

