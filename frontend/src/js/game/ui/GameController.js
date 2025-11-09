import { CameraController } from '../../camera';
import { FluteVisionAPI } from '../../api/api';
import { CameraToggleUI, VisionModeToggleUI } from '../../navigation';
import { GameEngine } from '../../game/core/GameEngine';
import { testLibrary } from '../music/MusicalTest';
import { imageManager } from '../assets/imageManager';
import { InputManager } from '../../game/managers/InputManager';
import { gameSettings } from '../../game/config/GameSettings';
import { GameConstants } from '../../game/config/GameConstants';
import { THEMES, CHARACTERS, getTheme, getDefaultTheme, getDefaultThemeName } from '../../game/config/ThemeConfig';

// main orchestrator - ties everything together
// using facade pattern bc other code shouldn't need to know about all the internal systems
class GameController {
    constructor() {
        // infrastructure - using CameraController for SOLID design
        this.cameraController = new CameraController('video');
        this.api = new FluteVisionAPI();
        this.imageManager = imageManager; // singleton
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
        
        // get available gestures from model by using camera stream's current mode (navbar state)
        const currentVisionMode = this.cameraController.stream?.predictionMode || gameSettings.get('visionMode');
        const gesturesData = await this.api.getAvailableGestures(currentVisionMode);
        const allGestures = gesturesData.fingerings || [];
        
        // filtering out "neutral", it's for CV detection only, not a target gesture
        this.availableGestures = allGestures.filter(g => g.toLowerCase() !== 'neutral');
        
        if (this.availableGestures.length === 0) {
            this._showError('No gestures trained. Train the model first.');
            return;
        }
        
        // set up camera state observer
        this.cameraController.onStateChange((state, isEnabled) => {
            this._handleCameraStateChange(state, isEnabled);
        });

        // preloading all character PNGs before creating the game engine
        try {
            this._updateStatus('Loading assets...');
            await this.imageManager.preloadImages(CHARACTERS);
            console.log('Character PNGs preloaded:', Object.keys(CHARACTERS));
        } catch (err) {
            console.error('Failed to preload character images:', err);
        }
        
        // preload theme assets (background, ground, obstacle images)
        try {
            const themeAssets = {};
            Object.entries(THEMES).forEach(([themeName, theme]) => {
                if (theme.backgroundImage) themeAssets[theme.backgroundImage] = theme.backgroundImage;
                if (theme.groundImage) themeAssets[theme.groundImage] = theme.groundImage;
                if (theme.obstacleImage) themeAssets[theme.obstacleImage] = theme.obstacleImage;
            });
            await this.imageManager.preloadImages(themeAssets);
            console.log('Theme assets preloaded:', Object.keys(themeAssets).length);
        } catch (err) {
            console.warn('Failed to preload theme images (will fallback to colors):', err);
        }
                
        // create game engine
        const canvas = document.getElementById('gameCanvas');
        this.gameEngine = new GameEngine(canvas, this.imageManager);
        
        // set up callbacks
        this.gameEngine.onGameOver = (score, combo, maxCombo) => 
            this._handleGameOver(score, combo, maxCombo);
        this.gameEngine.onScoreUpdate = (score, high, combo) => 
            this._updateScore(score, high, combo);
        this.gameEngine.onNoteChange = (gesture, time) =>
            this._handleNoteChange(gesture, time);
        this.gameEngine.onLivesUpdate = (lives, maxLives) =>
            this._updateLives(lives, maxLives);
        this.gameEngine.onTestComplete = (stats) =>
            this._handleTestComplete(stats);
        
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
        
        // restore saved vision mode BEFORE initializing UI
        const visionMode = gameSettings.get('visionMode');
        if (visionMode && this.cameraController.stream) {
            this.cameraController.stream.predictionMode = visionMode;
            console.log(`Restored saved vision mode: ${visionMode}`);
        }
        
        // NOW initialize the UI so it shows the correct mode
        this.visionModeToggleUI.initialize('visionModeToggleBtn');
        
        // Make gameSettings available globally so navbar can update it
        window.gameSettings = gameSettings;
        
        // Listen for vision mode changes from navbar toggle
        window.addEventListener('visionModeChanged', async (e) => {
            const newMode = e.detail.mode;
            console.log('Vision mode changed to:', newMode);
            
            // Refresh available gestures for the new mode
            const gesturesData = await this.api.getAvailableGestures(newMode);
            const allGestures = gesturesData.fingerings || [];
            this.availableGestures = allGestures.filter(g => g.toLowerCase() !== 'neutral');
            console.log('Refreshed gestures for', newMode, ':', this.availableGestures);
            
            // Update test options if settings modal is open
            const modal = document.getElementById('gameSettingsModal');
            if (modal && !modal.classList.contains('hidden')) {
                this._populateTestOptions();
            }
            
            // If game is running, restart it with new mode
            if (this.gameEngine && this.gameEngine.isRunning) {
                console.log('Game is running - restarting with new mode');
                this._pauseGame();
                
                // Stop current input monitoring
                if (this.inputManager) {
                    this.inputManager.stopMonitoring();
                }
                
                // Stop gesture change interval
                if (this.gestureChangeInterval) {
                    clearInterval(this.gestureChangeInterval);
                }
                
                // Reset and restart gameplay with new mode
                this.gameEngine.reset();
                this._startGameplay();
            } else if (this.gameEngine) {
                // Game exists but not running - just update the target display
                this._updateTargetDisplay('-');
            }
        });

        // set up UI event listeners
        this._setupEventListeners();
        
        this._updateStatus('Turn on camera (📹 in navbar) to start!');
        document.getElementById('startBtn').disabled = false;
        
        // Initialize lives display
        this._updateLives(this.gameEngine.lives, this.gameEngine.maxLives);
        
        // Load and apply game settings (theme, character, vision mode)
        this._loadGameSettings();
        
        // Populate test options initially
        this._populateTestOptions();
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
        
        // test complete buttons
        document.getElementById('testPlayAgainBtn')?.addEventListener('click', () => {
            this._restartGame();
        });
        
        document.getElementById('testMenuBtn')?.addEventListener('click', () => {
            this._stopGame();
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
        
        // game settings button on start screen 
        const startScreenSettingsBtn = document.getElementById('startScreenSettingsBtn');
        if (startScreenSettingsBtn) {
            startScreenSettingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
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
        
        // test selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-test]')) {
                document.querySelectorAll('[data-test]').forEach(b => b.classList.remove('selected'));
                e.target.closest('[data-test]').classList.add('selected');
            }
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
        this._populateThemeOptions();
        this._populateTestOptions();
        this._populateCharacterPreviews();
    }
    
    _closeGameSettings() {
        document.getElementById('gameSettingsModal').classList.add('hidden');
    }
    
    _loadGameSettings() {
        // Load saved settings and update UI
        const character = gameSettings.get('character');
        const theme = gameSettings.get('theme');
        
        // Populate themes first
        this._populateThemeOptions();
        
        // Update selected states in UI
        document.querySelectorAll('[data-character]').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.character === character);
        });
        
        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.theme === theme);
        });
        
        // Populate character preview images
        this._populateCharacterPreviews();
        
        // Apply settings to game
        this._applyGameSettings();
    }
    
    _populateTestOptions() {
        const container = document.getElementById('testOptionsContainer');
        if (!container) return;
        
        // Get current vision mode (from navbar toggle or saved setting)
        const visionMode = gameSettings.get('visionMode');
        
        // Only show tests for flute mode
        if (visionMode !== 'flute') {
            const message = document.createElement('p');
            message.style.color = '#999';
            message.style.padding = '1rem';
            message.style.textAlign = 'center';
            message.textContent = 'Tests are only available in Flute Mode.';
            container.replaceChildren(message);
            return;
        }
        
        // Get all available tests and filter to only show the 3 specified tests
        const allTests = this.testLibrary.getAllTests();
        const allowedTestNames = ['Hot Cross Buns', 'C Major Scale', 'Beginner Pattern (Bb-C-D)'];
        const tests = allTests.filter(test => allowedTestNames.includes(test.name));
        const currentTest = gameSettings.get('currentTest');
        const musicMode = gameSettings.get('musicMode');
        
        // Clear container
        container.replaceChildren();
        
        // Add "Random" option (for random mode)
        const randomCard = document.createElement('button');
        randomCard.className = 'option-card';
        randomCard.dataset.test = 'random';
        
        const randomIcon = document.createElement('div');
        randomIcon.className = 'option-icon';
        randomIcon.textContent = '🎲';
        
        const randomTitle = document.createElement('div');
        randomTitle.className = 'option-title';
        randomTitle.textContent = 'Random';
        
        const randomCheck = document.createElement('span');
        randomCheck.className = 'check-mark';
        randomCheck.textContent = '✓';
        
        randomCard.appendChild(randomIcon);
        randomCard.appendChild(randomTitle);
        randomCard.appendChild(randomCheck);
        
        if (musicMode === 'random' || !currentTest) {
            randomCard.classList.add('selected');
        }
        container.appendChild(randomCard);
        
        // test options (
        tests.forEach(test => {
            const testCard = document.createElement('button');
            testCard.className = 'option-card';
            testCard.dataset.test = test.name;
            
            const testIcon = document.createElement('div');
            testIcon.className = 'option-icon';
            testIcon.textContent = '🎵';
            
            const testTitle = document.createElement('div');
            testTitle.className = 'option-title';
            testTitle.textContent = test.name;
            
            const testCheck = document.createElement('span');
            testCheck.className = 'check-mark';
            testCheck.textContent = '✓';
            
            testCard.appendChild(testIcon);
            testCard.appendChild(testTitle);
            testCard.appendChild(testCheck);
            
            if (currentTest === test.name && musicMode === 'test') {
                testCard.classList.add('selected');
            }
            container.appendChild(testCard);
        });
    }
    
    _populateCharacterPreviews() {
        // Update character preview images in settings modal
        document.querySelectorAll('.character-preview').forEach(img => {
            const characterKey = img.dataset.characterKey;
            const charImageUrl = CHARACTERS[characterKey];

            if (!charImageUrl) {
                console.error(`failed to get char url for ${characterKey}`);
                return;
            }

            const characterImage = this.imageManager.getImage(characterKey);
            if (characterImage) {
                img.src = characterImage.src;
                img.style.display = 'block';
            }
        });
    }

    _populateThemeOptions() {
        document.querySelectorAll('.theme-preview').forEach(img => {
            const themeKey = img.dataset.themeKey;
            const themeConfig = THEMES[themeKey];

            if (!themeConfig) {
                console.error(`failed to get theme config for ${themeKey}`);
                return;
            }

            const themeBgURL = themeConfig.backgroundImage;
            const themeImage = this.imageManager.getImage(themeBgURL); 
            img.src = themeImage.src;
            img.style.display = 'block';
            console.log("Printed theme image successfully");
        });
    }
    
    _saveGameSettings() {
        // Get selected values from UI
        // Vision mode is controlled via navbar toggle, so get it from gameSettings
        const visionMode = gameSettings.get('visionMode');
        const character = document.querySelector('[data-character].selected')?.dataset.character || 'Hami';
        const theme = document.querySelector('[data-theme].selected')?.dataset.theme || getDefaultThemeName();
        
        // Get selected test
        const selectedTest = document.querySelector('[data-test].selected')?.dataset.test;
        let musicMode = 'random';
        let currentTest = null;
        
        if (selectedTest && selectedTest !== 'random') {
            musicMode = 'test';
            currentTest = selectedTest;
        }
        
        console.log('Saving game settings:', { visionMode, character, theme, musicMode, currentTest });
        
        // Save to game settings
        gameSettings.setMultiple({
            visionMode,
            character,
            theme,
            musicMode,
            currentTest
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
        const theme = getTheme(themeName) || getDefaultTheme();
        console.log('Applying theme:', themeName, theme);
        
        // Update gameSettings with theme colors so obstacles and other entities use them
        gameSettings.setMultiple({
            playerColor: theme.playerColor,
            obstacleColor: theme.obstacleColor
        });
        
        if (this.gameEngine && this.gameEngine.renderSystem) {
            this.gameEngine.renderSystem.setTheme(theme);
        }
        
        if (this.gameEngine && this.gameEngine.setTheme) {
            this.gameEngine.setTheme(themeName);
        }
        
        // Apply character
        const characterName = gameSettings.get('character');
        console.log('Applying character:', characterName);
        
        if (this.gameEngine && this.gameEngine.player) {
            this.gameEngine.player.setCharacter(characterName);
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
            pauseBtn.replaceChildren();
            const pauseIcon = document.createElement('span');
            pauseIcon.className = 'pause-icon';
            pauseIcon.textContent = '⏸';
            pauseBtn.appendChild(pauseIcon);
            pauseBtn.appendChild(document.createTextNode(' PAUSE'));
        } else if (this.gameEngine.isRunning) {
            // Currently running, so pause
            this._pauseGame();
            pauseBtn.replaceChildren();
            const resumeIcon = document.createElement('span');
            resumeIcon.className = 'pause-icon';
            resumeIcon.textContent = '▶';
            pauseBtn.appendChild(resumeIcon);
            pauseBtn.appendChild(document.createTextNode(' RESUME'));
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
        pauseBtn.replaceChildren();
        const pauseIcon = document.createElement('span');
        pauseIcon.className = 'pause-icon';
        pauseIcon.textContent = '⏸';
        pauseBtn.appendChild(pauseIcon);
        pauseBtn.appendChild(document.createTextNode(' PAUSE'));
        
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
    
    async _startGameplay() {
        // Refresh gestures before starting in case vision mode was changed
        const visionMode = gameSettings.get('visionMode');
        const gesturesData = await this.api.getAvailableGestures(visionMode);
        const allGestures = gesturesData.fingerings || [];
        
        this.availableGestures = allGestures.filter(g => g.toLowerCase() !== 'neutral');
        console.log('Refreshed gestures for', visionMode, ':', this.availableGestures);
        
        // check camera state before starting gameplay
        if (!this.cameraController.isEnabled()) {
            this._updateStatus('Camera must be on to play!');
            return;
        }
        
        // initialize hearts display
        this._updateLives(this.gameEngine.lives, this.gameEngine.maxLives);
        
        // extracted common gameplay start logic bc it's used by both start and restart
        // check if using musical test mode (only available in flute mode)
        const mode = gameSettings.get('musicMode');
        
        if (mode === 'test' && visionMode === 'flute') {
            const testName = gameSettings.get('currentTest');
            let test = this.testLibrary.getTest(testName);
            
            if (test) {
                this.gameEngine.setMusicalTest(test);
                console.log(`Starting musical test: ${testName}`);
            } else {
                console.warn('Test not found, falling back to random mode');
                this.gameEngine.setMusicalTest(null);
            }
        } else {
            // hand mode always uses random mode (tests are flute-only)
            this.gameEngine.setMusicalTest(null);
            if (mode === 'test' && visionMode === 'hand') {
                console.log('Hand mode detected - using random mode (tests are flute-only)');
            }
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
        document.getElementById('testCompleteBackdrop').classList.add('hidden');
        
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
    
    _handleTestComplete(stats) {
        // stop input monitoring
        this.inputManager.stopMonitoring();
        
        // stop gesture changes
        if (this.gestureChangeInterval) {
            clearInterval(this.gestureChangeInterval);
        }
        
        // show test complete screen with stats
        document.getElementById('completedTestName').textContent = stats.testName;
        document.getElementById('testFinalScore').textContent = stats.score;
        document.getElementById('testMaxCombo').textContent = stats.maxCombo;
        document.getElementById('testAccuracy').textContent = `${stats.accuracy}%`;
        document.getElementById('testNotesHit').textContent = stats.notesHit;
        document.getElementById('testTotalNotes').textContent = stats.totalNotes;
        document.getElementById('testDuration').textContent = (stats.duration / 1000).toFixed(1);
        document.getElementById('testCompleteBackdrop').classList.remove('hidden');
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
        console.log('Selected target gesture:', newGesture, 'from available:', this.availableGestures);
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
        heartsContainer.replaceChildren();
        
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