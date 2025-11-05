class FluteVisionUI {
    constructor() {
        this.camera = new CameraStream();
        this.api = new FluteVisionAPI();
        this.currentPrediction = null;
        this.isRunning = false;
    }

    async initialize() {
        console.log('Initializing FluteVision UI...');
        
        this.updateStatus('Checking API...');
        
        // check health first bc no point initializing camera if backend is down
        const health = await this.api.healthCheck();
        console.log('API Health:', health);
        
        if (health.status === 'error') {
            this.showError('Backend API is not running. Please start the backend server.');
            return;
        }
        
        if (health.status !== 'healthy') {
            this.showError('Model not loaded. Check backend logs.');
            return;
        }
        
        this.updateStatus('API Ready ✓');
        
        // load available gestures so user knows what the model can recognize
        const gestures = await this.api.getAvailableGestures();
        console.log('Available gestures:', gestures);
        this.displayAvailableGestures(gestures.fingerings || []);
        
        this.updateStatus('Initializing camera...');
        const cameraReady = await this.camera.initialize();
        
        if (!cameraReady) {
            this.showError('Could not access camera. Please grant camera permissions.');
            return;
        }
        
        this.updateStatus('Camera Ready ✓');
        
        this.setupControls();
        
        // auto-start bc it's more intuitive than making user click a button
        this.startPredictions();
    }

    setupControls() {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startPredictions());
        }
        
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopPredictions());
        }
    }

    startPredictions() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.updateStatus('Running predictions...');
        
        this.camera.startStreaming((prediction) => {
            this.updatePrediction(prediction);
        });
        
        // disable start button so user doesn't accidentally try to start twice
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
    }

    stopPredictions() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        this.camera.stopStreaming();
        this.updateStatus('Stopped');
        
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
    }

    updatePrediction(prediction) {
        this.currentPrediction = prediction;
        
        const gestureEl = document.getElementById('gesture');
        const confidenceEl = document.getElementById('confidence');
        const messageEl = document.getElementById('message');
        
        if (prediction.success) {
            gestureEl.textContent = prediction.gesture || 'None';
            gestureEl.className = 'gesture-value success';
            
            const confidencePercent = (prediction.confidence * 100).toFixed(1);
            confidenceEl.textContent = `${confidencePercent}%`;
            confidenceEl.className = 'confidence-value';
            
            // color coding helps user quickly see if the model is confident or guessing
            if (prediction.confidence > 0.8) {
                confidenceEl.classList.add('high');
            } else if (prediction.confidence > 0.5) {
                confidenceEl.classList.add('medium');
            } else {
                confidenceEl.classList.add('low');
            }
            
            if (messageEl) {
                messageEl.textContent = '';
            }
            
            this.updateAllProbabilities(prediction.all_predictions);
        } else {
            gestureEl.textContent = 'No hand detected';
            gestureEl.className = 'gesture-value';
            confidenceEl.textContent = '0%';
            confidenceEl.className = 'confidence-value';
            
            if (messageEl && prediction.message) {
                messageEl.textContent = prediction.message;
            }
        }
    }

    updateAllProbabilities(probabilities) {
        const probsContainer = document.getElementById('allProbabilities');
        if (!probsContainer || !probabilities) return;
        
        // showing top 5 bc that's enough to see if model is confused between similar gestures
        const sorted = Object.entries(probabilities)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        probsContainer.innerHTML = sorted.map(([gesture, prob]) => `
            <div class="probability-item">
                <span class="prob-gesture">${gesture}</span>
                <span class="prob-bar-container">
                    <span class="prob-bar" style="width: ${prob * 100}%"></span>
                </span>
                <span class="prob-value">${(prob * 100).toFixed(1)}%</span>
            </div>
        `).join('');
    }

    displayAvailableGestures(gestures) {
        const gesturesEl = document.getElementById('availableGestures');
        if (!gesturesEl) return;
        
        if (gestures.length === 0) {
            gesturesEl.innerHTML = '<em>No gestures loaded</em>';
        } else {
            gesturesEl.innerHTML = gestures.join(', ');
        }
    }

    updateStatus(status) {
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = status;
        }
        console.log('Status:', status);
    }

    showError(message) {
        console.error(message);
        const errorEl = document.getElementById('error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
        this.updateStatus('Error');
    }
}
