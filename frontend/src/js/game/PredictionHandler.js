// SRP: bridges camera predictions to game actions
class PredictionHandler {
    constructor(camera, availableGestures) {
        this.camera = camera;
        this.availableGestures = availableGestures;
        this.targetGesture = null;
        this.currentPrediction = null;
        this.onCorrectGesture = null; // callback for when correct gesture detected
        
        this._selectRandomTarget();
    }
    
    startMonitoring(onPrediction) {
        this.camera.startStreaming((prediction) => {
            this.currentPrediction = prediction;
            if (onPrediction) onPrediction(prediction);
            
            // check if correct gesture was played with high confidence
            this._checkGesture(prediction);
        });
    }
    
    stopMonitoring() {
        this.camera.stopStreaming();
    }
    
    changeTarget() {
        this._selectRandomTarget();
    }
    
    getTargetGesture() {
        return this.targetGesture;
    }
    
    getCurrentPrediction() {
        return this.currentPrediction;
    }
    
    _selectRandomTarget() {
        if (this.availableGestures.length === 0) return;
        
        // pick random gesture that's different from current
        let newGesture;
        do {
            const idx = Math.floor(Math.random() * this.availableGestures.length);
            newGesture = this.availableGestures[idx];
        } while (newGesture === this.targetGesture && this.availableGestures.length > 1);
        
        this.targetGesture = newGesture;
    }
    
    _checkGesture(prediction) {
        if (!prediction.success) return;
        if (!this.targetGesture) return;
        if (!this.onCorrectGesture) return;
        
        // correct gesture with sufficient confidence triggers jump
        if (prediction.gesture === this.targetGesture && 
            prediction.confidence >= GameConfig.JUMP_CONFIDENCE_THRESHOLD) {
            this.onCorrectGesture();
        }
    }
}

