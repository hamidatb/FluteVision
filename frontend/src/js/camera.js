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
        this.isStreaming = false;
        this.frameInterval = null;
        this.lastRequestTime = 0;
        this.minRequestInterval = 100; // throttle to 10 FPS bc sending every frame would overwhelm the backend and cause lag
        this.pendingRequest = false;
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
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user' 
                }
            });
            
            this.video.srcObject = stream;
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
        const response = await fetch(`${this.apiUrl}/predict/base64`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: imageData })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        
        return await response.json();
    }
}
