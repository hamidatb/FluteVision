import { CameraController } from '../camera';
import { FluteVisionAPI } from '../api/api';
import { CameraToggleUI, VisionModeToggleUI } from '../navigation';

// practice mode controller - handles real-time detection without game logic
class PracticeMode {
    constructor() {
        // using CameraController for SOLID design and camera toggle support
        this.cameraController = new CameraController('practiceVideo');
        this.api = new FluteVisionAPI();
        this.cameraToggleUI = null;
        this.visionModeToggleUI = null;
        this.isRunning = false;
        this.targetGesture = null;
        this.availableGestures = [];
        this.startTime = null;
        this.timerInterval = null;
        this.practiceMinutes = 0;
    }

    async initialize() {
        this.updateStatus('Checking API...', 'info');

        const health = await this.api.healthCheck();
        if (health.status !== 'healthy') {
            this.updateStatus('Backend not ready. Start backend server first.', 'warning');
            return;
        }

        // Get gestures for current vision mode
        const visionMode = this.cameraController.stream.predictionMode || 'flute';
        const gesturesData = await this.api.getAvailableGestures(visionMode);
        const allGestures = gesturesData.fingerings || [];
        
        // filtering out 'neutral' - it's for CV detection only, not a practice target
        this.availableGestures = allGestures.filter(g => g.toLowerCase() !== 'neutral');
        //console.log(`Loaded gestures for ${visionMode} mode:`, this.availableGestures);

        if (this.availableGestures.length === 0) {
            this.updateStatus('No gestures available. Train the model first.', 'warning');
            return;
        }

        this.populateGestureSelector();

        this.updateStatus('Initializing camera...', 'info');

        // set up camera state observer
        this.cameraController.onStateChange((state, isEnabled) => {
            this.handleCameraStateChange(state, isEnabled);
        });

        // initialize camera toggle UI
        this.cameraToggleUI = new CameraToggleUI(this.cameraController);
        this.cameraToggleUI.initialize('cameraToggleBtn');

        // 🎵 initialize vision mode toggle (for flute vs hand)
        this.visionModeToggleUI = new VisionModeToggleUI(this.cameraController);
        this.visionModeToggleUI.initialize('visionModeToggleBtn');

        this.setupEventListeners();
        this.updateStatus('Turn on the camera to enable practice mode :)', 'warning');
    }

    handleCameraStateChange(state, isEnabled) {
        // handle camera on/off state changes
        if (!isEnabled) {
            // camera turned off - stop practice if running
            if (this.isRunning) {
                this.stop();
                this.updateStatus('Camera off - Practice stopped. Turn on camera to continue.', 'warning');
            }
            
            // disable start button
            document.getElementById('startBtn').disabled = true;
        } else {
            // camera turned on
            if (!this.isRunning) {
                document.getElementById('startBtn').disabled = false;
                this.updateStatus('Camera on - Ready to practice!', 'success');
            }

            // enable landmark visualization by default when camera turns on
            const landmarkToggle = document.getElementById('landmarkToggle');
            if (landmarkToggle && this.cameraController.enableLandmarkVisualization()) {
                landmarkToggle.classList.add('active');
            }
        }
    }

    populateGestureSelector() {
        // populate dropdown with available gestures bc user might want to target specific ones
        const selector = document.getElementById('targetSelector');
        this.availableGestures.forEach(gesture => {
            const option = document.createElement('option');
            option.value = gesture;
            option.textContent = gesture;
            selector.appendChild(option);
        });
    }

    setupEventListeners() {
        // attach all event handlers for practice controls
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('stopBtn').addEventListener('click', () => this.stop());
        document.getElementById('targetSelector').addEventListener('change', (e) => {
            this.targetGesture = e.target.value || null;
            this.updateTargetDisplay();
        });

        // landmark visualization toggle
        const landmarkToggle = document.getElementById('landmarkToggle');
        if (landmarkToggle) {
            landmarkToggle.addEventListener('click', () => {
                const isEnabled = this.cameraController.toggleLandmarkVisualization();
                if (isEnabled) {
                    landmarkToggle.classList.add('active');
                } else {
                    landmarkToggle.classList.remove('active');
                }
            });
        }
    }

    start() {
        // check if camera is enabled before starting
        if (!this.cameraController.isEnabled()) {
            this.updateStatus('Please turn on the camera to practice!', 'warning');
            return;
        }

        // start practicing and streaming from camera
        this.isRunning = true;
        this.startTime = Date.now();

        // use the camera stream from controller (backward compatible)
        this.cameraController.stream.startStreaming((prediction) => {
            this.updatePredictionDisplay(prediction);
        });

        this.timerInterval = setInterval(() => this.updateTimer(), 1000);

        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;
        this.updateStatus('Practicing...', 'success');
    }

    stop() {
        // stop practice session
        this.isRunning = false;
        this.cameraController.stream.stopStreaming();

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        // save practice time to stats bc we want to track progress
        this.savePracticeTime();

        // only enable start button if camera is on
        document.getElementById('startBtn').disabled = !this.cameraController.isEnabled();
        document.getElementById('stopBtn').disabled = true;
        this.updateStatus('Practice stopped', 'info');
    }

    updatePredictionDisplay(prediction) {
        // show current detected gesture and confidence level
        const gestureEl = document.getElementById('currentGesture');
        const fillEl = document.getElementById('confidenceFill');

        if (prediction.success) {
            gestureEl.textContent = prediction.gesture;
            const confidencePercent = (prediction.confidence * 100).toFixed(0);
            fillEl.style.width = `${confidencePercent}%`;
            fillEl.textContent = `${confidencePercent}%`;

            // highlight green if matches target gesture bc visual feedback is motivating
            if (this.targetGesture && prediction.gesture === this.targetGesture) {
                gestureEl.className = 'current-gesture correct';
            } else {
                gestureEl.className = 'current-gesture';
            }

            this.updateAllProbabilities(prediction.all_predictions);
        } else {
            gestureEl.textContent = '-';
            gestureEl.className = 'current-gesture';
            fillEl.style.width = '0%';
            fillEl.textContent = '0%';
        }
    }

    updateAllProbabilities(probabilities) {
        // show all detected gestures ranked by confidence
        const container = document.getElementById('allProbabilities');
        if (!probabilities) {
            const message = document.createElement('p');
            message.style.color = '#666';
            message.textContent = 'No detections yet';
            container.replaceChildren(message);
            return;
        }
    }

    selectRandomGesture() {
        // pick a random gesture to practice bc variety helps learning
        if (this.availableGestures.length === 0) return;

        const idx = Math.floor(Math.random() * this.availableGestures.length);
        this.targetGesture = this.availableGestures[idx];

        document.getElementById('targetSelector').value = this.targetGesture;
        this.updateTargetDisplay();
    }

    updateTargetDisplay() {
        // update UI to show which gesture user is practicing
        const targetEl = document.getElementById('targetGesture');
        targetEl.textContent = this.targetGesture || 'Free Practice';
    }

    updateTimer() {
        // update display timer and track elapsed time
        if (!this.startTime) return;

        const elapsed = Date.now() - this.startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        document.getElementById('timer').textContent =
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        this.practiceMinutes = minutes;
    }

    savePracticeTime() {
        // persist practice time to localStorage bc we track user stats
        const current = parseInt(localStorage.getItem('flutevision_practice_minutes') || '0');
        localStorage.setItem('flutevision_practice_minutes', (current + this.practiceMinutes).toString());
    }

    updateStatus(message, type) {
        // show status messages (info, success, warning)
        const statusEl = document.getElementById('statusMessage');
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const practice = new PracticeMode();
    practice.initialize();
});