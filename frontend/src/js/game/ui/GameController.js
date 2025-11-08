import { CameraController } from '../../camera';
import { FluteVisionAPI } from '../../api';
import { CameraToggleUI, VisionModeToggleUI } from '../../navigation';
import { GameEngine } from '../../game/core/GameEngine';
import { testLibrary } from '../music/MusicalTest';
import { assetManager } from '../assets/AssetManager';
import { InputManager } from '../../game/managers/InputManager';
import { gameSettings } from '../../game/config/GameSettings';
import { GameConstants } from '../../game/config/GameConstants';
import { THEMES, CHARACTERS } from '../../game/config/ThemeConfig';

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
        this.cameraToggleUI = null;
        this.visionModeToggleUI = null;
        
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
        this.gameEngine.onLivesUpdate = (lives, maxLives) =>
            this._updateLives(lives, maxLives);
        
        // create input manager - pass the camera stream (backward compatible)
        this.inputManager = new InputManager(this.cameraController.stream);
        this.inputManager.onCorrectInput = (gesture, confidence) => {
            this.gameEngine.makePlayerJump();
            this._flashSuccess();
        };
        
        // initialize camera toggle UI
        this.cameraToggleUI = new CameraToggleUI(this.cameraController);
        this.cameraToggleUI.initialize('cameraToggleBtn');
        
        // 🎵 initialize vision mode toggle (for flute vs hand)
        this.visionModeToggleUI = new VisionModeToggleUI(this.cameraController);
        this.visionModeToggleUI.initialize('visionModeToggleBtn');

        // restore saved vision mode if available
        const visionMode = gameSettings.get('visionMode');
        if (visionMode && this.cameraController.stream) {
            this.cameraController.stream.predictionMode = visionMode;
            console.log(`Restored saved vision mode: ${visionMode}`);
        }

        // set up UI event listeners
        this._setupEventListeners();
        
        this._updateStatus('Turn on camera (📹 in navbar) to start!');
        document.getElementById('startBtn').disabled = false;
        
        // Initialize lives display
        this._updateLives(this.gameEngine.lives, this.gameEngine.maxLives);
        
        // Load and apply game settings (theme, character, vision mode)
        this._loadGameSettings();
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
        
        // pause button
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this._togglePause();
            });
        }
        
        // stop button
        const stopBtn = document.getElementById('stopBtn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this._stopGame();
            });
        }
        
        // game settings button in header
        const gameSettingsBtn = document.getElementById('gameSettingsBtn');
        if (gameSettingsBtn) {
            gameSettingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Game settings button clicked');
                this._openGameSettings();
            });
        }
        
        // game settings modal backdrop click (close when clicking outside)
        const gameSettingsModal = document.getElementById('gameSettingsModal');
        if (gameSettingsModal) {
            gameSettingsModal.addEventListener('click', (e) => {
                if (e.target === gameSettingsModal) {
                    this._closeGameSettings();
                }
            });
        }
        
        // vision mode selection
        document.querySelectorAll('[data-vision]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('[data-vision]').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
            });
        });
        
        // character selection
        document.querySelectorAll('[data-character]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('[data-character]').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
            });
        });
        
        // theme selection
        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('[data-theme]').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
            });
        });
        
        // save and cancel buttons in settings modal
        const saveGameSettings = document.getElementById('saveGameSettings');
        if (saveGameSettings) {
            saveGameSettings.addEventListener('click', () => {
                this._saveGameSettings();
            });
        }
        
        const closeGameSettings = document.getElementById('closeGameSettings');
        if (closeGameSettings) {
            closeGameSettings.addEventListener('click', () => {
                this._closeGameSettings();
            });
        }
    }
    
    _openGameSettings() {
        document.getElementById('gameSettingsModal').classList.remove('hidden');
    }
    
    _closeGameSettings() {
        document.getElementById('gameSettingsModal').classList.add('hidden');
    }
    
    _loadGameSettings() {
        // Load saved settings and update UI
        const visionMode = gameSettings.get('visionMode');
        const character = gameSettings.get('character');
        const theme = gameSettings.get('theme');
        
        // Update selected states in UI
        document.querySelectorAll('[data-vision]').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.vision === visionMode);
        });
        
        document.querySelectorAll('[data-character]').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.character === character);
        });
        
        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.theme === theme);
        });
        
        // Apply settings to game
        this._applyGameSettings();
    }
    
    _saveGameSettings() {
        // Get selected values from UI
        const visionMode = document.querySelector('[data-vision].selected')?.dataset.vision || 'flute';
        const character = document.querySelector('[data-character].selected')?.dataset.character || 'cat';
        const theme = document.querySelector('[data-theme].selected')?.dataset.theme || 'forest';
        
        console.log('Saving game settings:', { visionMode, character, theme });
        
        // Save to game settings
        gameSettings.setMultiple({
            visionMode,
            character,
            theme
        });
        
        // Apply the new settings
        this._applyGameSettings();
        
        // Force a re-render if game is running
        if (this.gameEngine && this.gameEngine.isRunning) {
            // The game loop will automatically pick up the new character on next frame
        }
        
        // Close modal
        this._closeGameSettings();
    }
    
    _applyGameSettings() {
        // Apply vision mode to camera
        const visionMode = gameSettings.get('visionMode');
        console.log('Applying vision mode:', visionMode);
        if (this.cameraController && this.cameraController.cameraStream) {
            this.cameraController.cameraStream.predictionMode = visionMode;
        }
        
        // Apply theme colors to render system and game settings
        const themeName = gameSettings.get('theme');
        const theme = THEMES[themeName] || THEMES.forest;
        console.log('Applying theme:', themeName, theme);
        
        // Update gameSettings with theme colors so obstacles and other entities use them
        gameSettings.setMultiple({
            playerColor: theme.playerColor,
            obstacleColor: theme.obstacleColor
        });
        
        if (this.gameEngine && this.gameEngine.renderSystem) {
            this.gameEngine.renderSystem.setTheme(theme);
        }
        
        // Apply character
        const characterName = gameSettings.get('character');
        const character = CHARACTERS[characterName] || CHARACTERS.cat;
        console.log('Applying character:', characterName, character);
        
        if (this.gameEngine && this.gameEngine.player) {
            this.gameEngine.player.setCharacter(character);
            this.gameEngine.player.setColor(theme.playerColor);
            console.log('Character applied to player:', this.gameEngine.player.character);
        } else {
            console.warn('GameEngine or player not initialized yet');
        }
    }
    
    _togglePause() {
        if (!this.gameEngine) return;
        
        const pauseBtn = document.getElementById('pauseBtn');
        
        if (this.gameEngine.isPaused) {
            // Currently paused, so resume
            this.gameEngine.resume();
            if (this.cameraController.isEnabled()) {
                this.inputManager.startMonitoring((prediction) => {
                    this._updatePredictionDisplay(prediction);
                });
            }
            pauseBtn.innerHTML = '<span class="pause-icon">⏸</span> PAUSE';
        } else if (this.gameEngine.isRunning) {
            // Currently running, so pause
            this._pauseGame();
            pauseBtn.innerHTML = '<span class="pause-icon">▶</span> RESUME';
        }
    }
    
    _stopGame() {
        if (!this.gameEngine) return;
        
        // Stop everything
        this._pauseGame();
        this.gameEngine.stop();
        this.gameEngine.reset();
        
        // Show start screen again
        document.getElementById('startScreenBackdrop').classList.remove('hidden');
        
        // Reset pause button
        const pauseBtn = document.getElementById('pauseBtn');
        pauseBtn.innerHTML = '<span class="pause-icon">⏸</span> PAUSE';
        
        // Reset UI
        this._updateStatus('Turn on camera (📹 in navbar) to start!');
    }
    
    _startGame() {
        // check if camera is enabled before starting
        if (!this.cameraController.isEnabled()) {
            this._updateStatus('Please turn on the camera to play!');
            return;
        }
        
        document.getElementById('startScreenBackdrop').classList.add('hidden');
        this._startGameplay();
    }
    
    _startGameplay() {
        // check camera state before starting gameplay
        if (!this.cameraController.isEnabled()) {
            this._updateStatus('Camera must be on to play!');
            return;
        }
        
        // initialize hearts display
        this._updateLives(this.gameEngine.lives, this.gameEngine.maxLives);
        
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
        document.getElementById('gameOverBackdrop').classList.add('hidden');
        
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
        document.getElementById('gameOverBackdrop').classList.remove('hidden');
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
        
        if (prediction.success) {
            gestureEl.textContent = prediction.gesture;
            
            // green if matches target
            const isCorrect = prediction.gesture === this.currentTargetGesture;
            gestureEl.style.color = isCorrect ? '#00ff00' : '#ffffff';
        } else {
            gestureEl.textContent = '-';
            gestureEl.style.color = '#ffffff';
        }
    }
    
    _updateTargetDisplay(gesture) {
        document.getElementById('targetGesture').textContent = gesture || '-';
    }
    
    _updateScore(score, highScore, combo) {
        document.getElementById('headerScore').textContent = score;
    }
    
    _updateLives(lives, maxLives) {
        const heartsContainer = document.getElementById('heartsContainer');
        if (!heartsContainer) return;
        
        // clear existing hearts
        heartsContainer.innerHTML = '';
        
        // create hearts based on max lives
        for (let i = 0; i < maxLives; i++) {
            const heart = document.createElement('div');
            heart.className = 'heart';
            
            if (i < lives) {
                heart.classList.add('filled');
                heart.textContent = '❤️';
            } else {
                heart.classList.add('empty');
                heart.textContent = '❤️';
            }
            
            heartsContainer.appendChild(heart);
        }
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