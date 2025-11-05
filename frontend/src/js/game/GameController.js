// orchestrates all components - facade pattern
class GameController {
    constructor() {
        this.camera = new CameraStream();
        this.api = new FluteVisionAPI();
        this.gameEngine = null;
        this.predictionHandler = null;
        
        this.availableGestures = [];
        this.gestureChangeInterval = null;
    }
    
    async initialize() {
        // check API health
        this._updateStatus('Checking API...');
        const health = await this.api.healthCheck();
        
        if (health.status !== 'healthy') {
            this._showError('Backend not ready. Start the backend server.');
            return;
        }
        
        // get available gestures
        const gesturesData = await this.api.getAvailableGestures();
        this.availableGestures = gesturesData.fingerings || [];
        
        if (this.availableGestures.length === 0) {
            this._showError('No gestures available. Train the model first.');
            return;
        }
        
        // initialize camera
        this._updateStatus('Initializing camera...');
        const cameraReady = await this.camera.initialize();
        
        if (!cameraReady) {
            this._showError('Could not access camera.');
            return;
        }
        
        // initialize game engine
        const canvas = document.getElementById('gameCanvas');
        this.gameEngine = new GameEngine(canvas, this.availableGestures);
        
        // set up callbacks
        this.gameEngine.onGameOver = (score) => this._handleGameOver(score);
        this.gameEngine.onScoreUpdate = (score, high) => this._updateScore(score, high);
        
        // initialize prediction handler
        this.predictionHandler = new PredictionHandler(
            this.camera,
            this.availableGestures
        );
        
        // when correct gesture detected, make player jump
        this.predictionHandler.onCorrectGesture = () => {
            this.gameEngine.makePlayerJump();
            this._flashSuccess();
        };
        
        // set up UI
        this._setupEventListeners();
        
        this._updateStatus('Ready to play!');
        document.getElementById('startBtn').disabled = false;
    }
    
    _setupEventListeners() {
        document.getElementById('startBtn').addEventListener('click', () => {
            this._startGame();
        });
        
        document.getElementById('restartBtn').addEventListener('click', () => {
            this._restartGame();
        });
    }
    
    _startGame() {
        // hide start screen
        document.getElementById('startScreen').classList.add('hidden');
        
        // start monitoring predictions
        this.predictionHandler.startMonitoring((prediction) => {
            this._updatePredictionDisplay(prediction);
        });
        
        // update target gesture display
        this._updateTargetGesture();
        
        // change target gesture periodically
        this.gestureChangeInterval = setInterval(() => {
            this.predictionHandler.changeTarget();
            this._updateTargetGesture();
        }, GameConfig.GESTURE_CHANGE_INTERVAL);
        
        // start game
        this.gameEngine.start();
    }
    
    _restartGame() {
        // hide game over screen
        document.getElementById('gameOverScreen').classList.add('hidden');
        
        // reset game
        this.gameEngine.reset();
        this.predictionHandler.changeTarget();
        this._updateTargetGesture();
        
        // restart
        this.gameEngine.start();
    }
    
    _handleGameOver(finalScore) {
        // stop everything
        this.predictionHandler.stopMonitoring();
        if (this.gestureChangeInterval) {
            clearInterval(this.gestureChangeInterval);
        }
        
        // show game over screen
        document.getElementById('finalScore').textContent = finalScore;
        document.getElementById('gameOverScreen').classList.remove('hidden');
    }
    
    _updatePredictionDisplay(prediction) {
        const gestureEl = document.getElementById('currentGesture');
        const fillEl = document.getElementById('confidenceFill');
        
        if (prediction.success) {
            gestureEl.textContent = prediction.gesture;
            fillEl.style.width = `${prediction.confidence * 100}%`;
            
            // color based on if it matches target
            const isCorrect = prediction.gesture === this.predictionHandler.getTargetGesture();
            gestureEl.style.color = isCorrect ? GameConfig.COLOR_SUCCESS : '#666';
        } else {
            gestureEl.textContent = '-';
            fillEl.style.width = '0%';
        }
    }
    
    _updateTargetGesture() {
        const target = this.predictionHandler.getTargetGesture();
        document.getElementById('targetGesture').textContent = target || '-';
    }
    
    _updateScore(score, highScore) {
        document.getElementById('score').textContent = score;
        document.getElementById('highScore').textContent = highScore;
    }
    
    _flashSuccess() {
        // visual feedback when correct gesture played
        const targetEl = document.getElementById('targetGesture');
        targetEl.style.color = GameConfig.COLOR_SUCCESS;
        targetEl.style.transform = 'scale(1.2)';
        
        setTimeout(() => {
            targetEl.style.color = '';
            targetEl.style.transform = '';
        }, 200);
    }
    
    _updateStatus(message) {
        const statusEl = document.getElementById('status');
        if (statusEl) statusEl.textContent = message;
    }
    
    _showError(message) {
        this._updateStatus(`Error: ${message}`);
    }
}

