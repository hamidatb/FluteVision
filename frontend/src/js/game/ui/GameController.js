// main orchestrator - ties everything together
// using facade pattern bc other code shouldn't need to know about all the internal systems
class GameController {
    constructor() {
        // infrastructure - using CameraController for SOLID design
        this.cameraController = new CameraController('video');
        this.api = new FluteVisionAPI();
        this.assetManager = assetManager; // singleton
        this.testLibrary = testLibrary; // singleton
        
        // core systems
        this.gameEngine = null;
        this.inputManager = null;
        this.settingsUI = null;
        this.cameraToggleUI = null;
        
        // state
        this.availableGestures = [];
        this.currentTargetGesture = null;
        this.gestureChangeInterval = null;
    }
    
    async initialize() {
        // check backend health
        this._updateStatus('Checking API...');
        const health = await this.api.healthCheck();
        
        if (health.status !== 'healthy') {
            this._showError('Backend not ready. Start backend server first.');
            return;
        }
        
        // get available gestures from model
        const gesturesData = await this.api.getAvailableGestures();
        this.availableGestures = gesturesData.fingerings || [];
        
        if (this.availableGestures.length === 0) {
            this._showError('No gestures trained. Train the model first.');
            return;
        }
        
        // initialize camera
        this._updateStatus('Initializing camera...');
        const cameraReady = await this.cameraController.initialize();
        
        if (!cameraReady) {
            this._showError('Could not access camera. Check permissions.');
            return;
        }
        
        // set up camera state observer
        this.cameraController.onStateChange((state, isEnabled) => {
            this._handleCameraStateChange(state, isEnabled);
        });
        
        // create game engine
        const canvas = document.getElementById('gameCanvas');
        this.gameEngine = new GameEngine(canvas, this.assetManager);
        
        // set up callbacks
        this.gameEngine.onGameOver = (score, combo, maxCombo) => 
            this._handleGameOver(score, combo, maxCombo);
        this.gameEngine.onScoreUpdate = (score, high, combo) => 
            this._updateScore(score, high, combo);
        this.gameEngine.onNoteChange = (gesture, time) =>
            this._handleNoteChange(gesture, time);
        
        // create input manager - pass the camera stream (backward compatible)
        this.inputManager = new InputManager(this.cameraController.stream);
        this.inputManager.onCorrectInput = (gesture, confidence) => {
            this.gameEngine.makePlayerJump();
            this._flashSuccess();
        };
        
        // create settings UI
        this.settingsUI = new SettingsUI(this.assetManager, this.testLibrary);
        
        // initialize camera toggle UI
        this.cameraToggleUI = new CameraToggleUI(this.cameraController);
        this.cameraToggleUI.initialize('cameraToggleBtn');
        
        // set up UI event listeners
        this._setupEventListeners();
        
        this._updateStatus('Ready to play!');
        document.getElementById('startBtn').disabled = false;
    }
    
    _handleCameraStateChange(state, isEnabled) {
        // handle camera on/off state changes
        if (!isEnabled) {
            // camera turned off - stop game if running
            if (this.gameEngine && this.gameEngine.isRunning) {
                this._pauseGame();
                this._updateStatus('Camera off - Game paused. Turn on camera to continue.');
            }
            
            // stop input monitoring
            if (this.inputManager) {
                this.inputManager.stopMonitoring();
            }
        } else {
            // camera turned on
            this._updateStatus('Camera on - Ready to play!');
            
            // resume input monitoring if game is running
            if (this.gameEngine && this.gameEngine.isRunning) {
                this.inputManager.startMonitoring((prediction) => {
                    this._updatePredictionDisplay(prediction);
                });
            }
        }
    }
    
    _pauseGame() {
        if (this.gameEngine) {
            this.gameEngine.pause();
        }
        if (this.gestureChangeInterval) {
            clearInterval(this.gestureChangeInterval);
        }
    }
    
    _setupEventListeners() {
        document.getElementById('startBtn').addEventListener('click', () => {
            this._startGame();
        });
        
        document.getElementById('restartBtn').addEventListener('click', () => {
            this._restartGame();
        });
        
        // settings button - create it and add click handler
        const settingsBtn = document.createElement('button');
        settingsBtn.id = 'settingsBtn';
        settingsBtn.textContent = '⚙️ Settings';
        settingsBtn.className = 'game-btn settings-btn';
        settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Settings button clicked');
            this.settingsUI.toggle();
        });
        
        // add to header if it exists
        const header = document.querySelector('header');
        if (header) {
            header.appendChild(settingsBtn);
        }
    }
    
    _startGame() {
        // check if camera is enabled before starting
        if (!this.cameraController.isEnabled()) {
            this._updateStatus('Please turn on the camera to play!');
            return;
        }
        
        document.getElementById('startScreen').classList.add('hidden');
        this._startGameplay();
    }
    
    _startGameplay() {
        // check camera state before starting gameplay
        if (!this.cameraController.isEnabled()) {
            this._updateStatus('Camera must be on to play!');
            return;
        }
        
        // extracted common gameplay start logic bc it's used by both start and restart
        // check if using musical test mode
        const mode = gameSettings.get('musicMode');
        
        if (mode === 'test') {
            const testName = gameSettings.get('currentTest');
            const test = this.testLibrary.getTest(testName);
            
            if (test) {
                this.gameEngine.setMusicalTest(test);
                console.log(`Starting musical test: ${testName}`);
            } else {
                console.warn('Test not found, falling back to random mode');
            }
        } else {
            this.gameEngine.setMusicalTest(null); // random mode
        }
        
        // start monitoring input (keyboard + gestures)
        this.inputManager.startMonitoring((prediction) => {
            this._updatePredictionDisplay(prediction);
        });
        
        // in random mode, change target gesture periodically
        if (!this.gameEngine.testMode) {
            this._selectRandomGesture();
            
            const interval = gameSettings.get('gestureChangeInterval');
            if (this.gestureChangeInterval) {
                clearInterval(this.gestureChangeInterval);
            }
            this.gestureChangeInterval = setInterval(() => {
                this._selectRandomGesture();
            }, interval);
        }
        
        // start game loop
        this.gameEngine.start();
    }
    
    _restartGame() {
        document.getElementById('gameOverScreen').classList.add('hidden');
        
        // reset game state
        this.gameEngine.reset();
        
        // restart everything using the same logic as initial start
        // this ensures input monitoring and intervals are properly restarted
        this._startGameplay();
    }
    
    _handleGameOver(finalScore, finalCombo, maxCombo) {
        // stop input monitoring
        this.inputManager.stopMonitoring();
        
        // stop gesture changes
        if (this.gestureChangeInterval) {
            clearInterval(this.gestureChangeInterval);
        }
        
        // show game over screen
        document.getElementById('finalScore').textContent = finalScore;
        document.getElementById('finalCombo').textContent = maxCombo;
        document.getElementById('gameOverScreen').classList.remove('hidden');
    }
    
    _handleNoteChange(gesture, time) {
        // called by engine when playing musical test
        this.currentTargetGesture = gesture;
        this.inputManager.setTargetGesture(gesture);
        this._updateTargetDisplay(gesture);
    }
    
    _selectRandomGesture() {
        // pick random gesture different from current
        let newGesture;
        do {
            const idx = Math.floor(Math.random() * this.availableGestures.length);
            newGesture = this.availableGestures[idx];
        } while (newGesture === this.currentTargetGesture && this.availableGestures.length > 1);
        
        this.currentTargetGesture = newGesture;
        this.inputManager.setTargetGesture(newGesture);
        this._updateTargetDisplay(newGesture);
    }
    
    _updatePredictionDisplay(prediction) {
        const gestureEl = document.getElementById('currentGesture');
        const fillEl = document.getElementById('confidenceFill');
        
        if (prediction.success) {
            gestureEl.textContent = prediction.gesture;
            fillEl.style.width = `${prediction.confidence * 100}%`;
            
            // green if matches target
            const isCorrect = prediction.gesture === this.currentTargetGesture;
            gestureEl.style.color = isCorrect ? GameConstants.COLOR_SUCCESS : '#666';
        } else {
            gestureEl.textContent = '-';
            fillEl.style.width = '0%';
        }
    }
    
    _updateTargetDisplay(gesture) {
        document.getElementById('targetGesture').textContent = gesture || '-';
    }
    
    _updateScore(score, highScore, combo) {
        document.getElementById('score').textContent = score;
        document.getElementById('highScore').textContent = highScore;
        document.getElementById('combo').textContent = combo > 1 ? `x${combo}` : '';
    }
    
    _flashSuccess() {
        // visual feedback when correct gesture played
        const targetEl = document.getElementById('targetGesture');
        targetEl.style.color = GameConstants.COLOR_SUCCESS;
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

window.addEventListener('DOMContentLoaded', () => {
            const controller = new GameController();
            controller.initialize();
        });