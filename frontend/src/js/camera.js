/**
 * CameraStateManager, this manages camera state
 */
class CameraStateManager {
    constructor() {
        this.isEnabled = false;
        this.observers = [];
    }

    enable() {
        if (!this.isEnabled) {
            this.isEnabled = true;
            this.notifyObservers('enabled');
        }
    }

    disable() {
        if (this.isEnabled) {
            this.isEnabled = false;
            this.notifyObservers('disabled');
        }
    }

    toggle() {
        if (this.isEnabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this.isEnabled;
    }

    // Observer pattern for loose coupling (DIP)
    addObserver(callback) {
        this.observers.push(callback);
    }

    removeObserver(callback) {
        this.observers = this.observers.filter(obs => obs !== callback);
    }

    notifyObservers(state) {
        this.observers.forEach(observer => observer(state, this.isEnabled));
    }
}

/**
 * CameraStream: handles video streaming and frame capture
 */
class CameraStream {
    constructor(apiUrl = null) {
        // dynamically determine API URL based on environment
        if (apiUrl) {
            this.apiUrl = apiUrl;
        } else if (window.location.hostname.includes('herokuapp.com')) {
            // on heroku, use the deployed backend API
            this.apiUrl = 'https://flutevision-api-2aeac29f3245.herokuapp.com/api/v1';
        } else {
            // local development
            this.apiUrl = 'http://localhost:8000/api/v1';
        }
        
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.stream = null;
        this.isStreaming = false;
        this.frameInterval = null;
        this.lastRequestTime = 0;
        this.minRequestInterval = 100; // throttle to 10 FPS bc sending every frame would overwhelm the backend and cause lag. Backend has rate limit of (600/minute)
        this.pendingRequest = false;
        this.predictionEndpoint = 'predict/base64'; // default to flute mode
    }
    
    setPredictionMode(mode) {
        // Set the API endpoint based on vision mode
        // 'flute' mode uses standard prediction, 'hand' mode uses hand gesture prediction
        this.predictionEndpoint = mode === 'hand' ? 'predict/hand' : 'predict/base64';
    }

    async initialize(videoElementId = 'video') {
        try {
            // allow specifying which video element to use bc different pages use different IDs
            this.video = document.getElementById(videoElementId);
            if (!this.video) {
                console.error(`Video element with id '${videoElementId}' not found`);
                return false;
            }
            
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d');
            
            console.log('Requesting camera access...');
            
            // using 640x480 bc it's a good balance between quality and performance for hand detection
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user' 
                }
            });
            
            this.video.srcObject = this.stream;
            await this.video.play();
            
            // need canvas to match video size so we can capture frames without distortion
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            console.log('Camera initialized successfully');
            return true;
        } catch (error) {
            console.error('Error accessing camera:', error);
            return false;
        }
    }

    startStreaming(onPrediction) {
        if (this.isStreaming) return;
        
        this.isStreaming = true;
        console.log('Starting prediction stream...');
        this.captureFrame(onPrediction);
    }

    stopStreaming() {
        this.isStreaming = false;
        if (this.frameInterval) {
            clearTimeout(this.frameInterval);
        }
        console.log('Streaming stopped');
    }

    // turn off camera completely (release hardware)
    turnOff() {
        this.stopStreaming();
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.video) {
            this.video.srcObject = null;
        }
        console.log('Camera turned off');
    }

    // check if camera is available (hardware initialized)
    isAvailable() {
        return this.stream !== null && this.video !== null;
    }

    async captureFrame(onPrediction) {
        if (!this.isStreaming || this.pendingRequest) {
            if (this.isStreaming) {
                this.frameInterval = setTimeout(() => this.captureFrame(onPrediction), 50);
            }
            return;
        }
        
        const now = Date.now();
        if (now - this.lastRequestTime < this.minRequestInterval) {
            // wait before sending next frame to avoid overwhelming the backend
            this.frameInterval = setTimeout(() => this.captureFrame(onPrediction), 
                this.minRequestInterval - (now - this.lastRequestTime));
            return;
        }

        this.ctx.drawImage(this.video, 0, 0);
        
        // jpeg compression at 85% quality bc we want smaller payloads for faster network transfer
        const imageData = this.canvas.toDataURL('image/jpeg', 0.85);
        
        this.pendingRequest = true;
        this.lastRequestTime = now;
        
        try {
            const prediction = await this.sendPredictionRequest(imageData);
            if (onPrediction) onPrediction(prediction);
        } catch (error) {
            console.error('Prediction error:', error);
            if (onPrediction) onPrediction({ success: false, error: error.message });
        } finally {
            this.pendingRequest = false;
            // keep the stream going even if a request fails
            if (this.isStreaming) {
                this.frameInterval = setTimeout(() => this.captureFrame(onPrediction), 
                    this.minRequestInterval);
            }
        }
    }

    async sendPredictionRequest(imageData) {
        const response = await fetch(`${this.apiUrl}/${this.predictionEndpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: imageData })
        });
        
        if (!response.ok) {            
            let errorText = await response.text();
            let errorMessage = errorText || response.statusText;

            throw new Error(errorMessage);
        }
        return await response.json();
    }
}

/**
 * CameraController - Coordinate camera lifecycle
 */
export class CameraController {
    constructor(videoElementId = 'video', apiUrl = null) {
        this.stateManager = new CameraStateManager();
        this.stream = new CameraStream(apiUrl);
        this.videoElementId = videoElementId;
        this.isInitialized = false;
    }

    async initialize() {
        if (!this.isInitialized) {
            const success = await this.stream.initialize(this.videoElementId);
            if (success) {
                this.stateManager.enable();
                this.isInitialized = true;
            }
            return success;
        }
        return true;
    }

    async turnOn() {
        if (!this.stream.isAvailable()) {
            const success = await this.initialize();
            if (success) {
                this.stateManager.enable();
            }
            return success;
        } else {
            this.stateManager.enable();
            return true;
        }
    }

    turnOff() {
        this.stream.turnOff();
        this.stateManager.disable();
        this.isInitialized = false;
    }

    async toggle() {
        if (this.stateManager.isEnabled) {
            this.turnOff();
            return false;
        } else {
            return await this.turnOn();
        }
    }

    startStreaming(onPrediction) {
        if (this.stateManager.isEnabled && this.stream.isAvailable()) {
            this.stream.startStreaming(onPrediction);
            return true;
        }
        return false;
    }

    stopStreaming() {
        this.stream.stopStreaming();
    }

    isEnabled() {
        return this.stateManager.isEnabled;
    }

    isAvailable() {
        return this.stream.isAvailable();
    }

    // Observer pattern for state changes (OCP - open for extension)
    onStateChange(callback) {
        this.stateManager.addObserver(callback);
    }

    offStateChange(callback) {
        this.stateManager.removeObserver(callback);
    }
}
