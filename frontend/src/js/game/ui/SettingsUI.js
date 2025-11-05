// UI for game settings - separated bc UI concerns shouldn't mix with game logic
class SettingsUI {
    constructor(assetManager, testLibrary) {
        this.assetManager = assetManager;
        this.testLibrary = testLibrary;
        this.isOpen = false;
        
        this._createSettingsPanel();
        this._attachEventListeners();
        this._loadCurrentSettings();
    }
    
    _createSettingsPanel() {
        // dynamically create settings panel bc keeping it in HTML gets messy
        const panel = document.createElement('div');
        panel.id = 'settingsPanel';
        panel.className = 'settings-panel hidden';
        panel.innerHTML = `
            <div class="settings-content">
                <h2>Game Settings</h2>
                
                <div class="setting-group">
                    <label>Difficulty:</label>
                    <select id="difficultySelect">
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                </div>
                
                <div class="setting-group">
                    <label>Mode:</label>
                    <select id="modeSelect">
                        <option value="random">Random (Endless)</option>
                        <option value="test">Musical Test</option>
                    </select>
                </div>
                
                <div class="setting-group" id="testGroup" style="display:none;">
                    <label>Select Test:</label>
                    <select id="testSelect"></select>
                </div>
                
                <div class="setting-group">
                    <label>Player Color:</label>
                    <input type="color" id="playerColorInput" value="#667eea">
                </div>
                
                <div class="setting-group">
                    <label>Obstacle Color:</label>
                    <input type="color" id="obstacleColorInput" value="#ef4444">
                </div>
                
                <div class="setting-group">
                    <label>Custom Player Image:</label>
                    <input type="file" id="playerImageInput" accept="image/*">
                    <button id="clearPlayerImage" class="small-btn">Clear</button>
                </div>
                
                <div class="setting-group">
                    <label>Custom Background:</label>
                    <input type="file" id="backgroundImageInput" accept="image/*">
                    <button id="clearBackground" class="small-btn">Clear</button>
                </div>
                
                <div class="setting-group">
                    <label>Confidence Threshold:</label>
                    <input type="range" id="thresholdSlider" min="0.5" max="0.9" step="0.05" value="0.7">
                    <span id="thresholdValue">70%</span>
                </div>
                
                <div class="settings-buttons">
                    <button id="saveSettings" class="game-btn">Save</button>
                    <button id="closeSettings" class="game-btn secondary">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.panel = panel;
    }
    
    _attachEventListeners() {
        // mode change shows/hides test selection
        document.getElementById('modeSelect').addEventListener('change', (e) => {
            const testGroup = document.getElementById('testGroup');
            testGroup.style.display = e.target.value === 'test' ? 'block' : 'none';
        });
        
        // threshold slider updates label
        const slider = document.getElementById('thresholdSlider');
        slider.addEventListener('input', (e) => {
            const value = (parseFloat(e.target.value) * 100).toFixed(0);
            document.getElementById('thresholdValue').textContent = `${value}%`;
        });
        
        // file inputs for custom images
        document.getElementById('playerImageInput').addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                await this.assetManager.loadFromFile('player', e.target.files[0]);
            }
        });
        
        document.getElementById('backgroundImageInput').addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                await this.assetManager.loadFromFile('background', e.target.files[0]);
            }
        });
        
        // clear custom images
        document.getElementById('clearPlayerImage').addEventListener('click', () => {
            // remove from asset manager bc we don't want to keep it in memory
            this.assetManager.images.delete('player');
            document.getElementById('playerImageInput').value = '';
        });
        
        document.getElementById('clearBackground').addEventListener('click', () => {
            this.assetManager.images.delete('background');
            document.getElementById('backgroundImageInput').value = '';
        });
        
        // save/cancel
        document.getElementById('saveSettings').addEventListener('click', () => {
            this._saveSettings();
            this.close();
        });
        
        document.getElementById('closeSettings').addEventListener('click', () => {
            this.close();
        });
    }
    
    _loadCurrentSettings() {
        // populate form with current settings
        const settings = gameSettings.getAll();
        
        document.getElementById('difficultySelect').value = settings.difficulty;
        document.getElementById('modeSelect').value = settings.musicMode;
        document.getElementById('playerColorInput').value = settings.playerColor;
        document.getElementById('obstacleColorInput').value = settings.obstacleColor;
        document.getElementById('thresholdSlider').value = settings.confidenceThreshold;
        
        // populate test library dropdown
        const testSelect = document.getElementById('testSelect');
        const tests = this.testLibrary.getTestNames();
        testSelect.innerHTML = tests.map(name => 
            `<option value="${name}">${name}</option>`
        ).join('');
        
        if (settings.currentTest) {
            testSelect.value = settings.currentTest;
        }
        
        // show/hide test group based on mode
        const testGroup = document.getElementById('testGroup');
        testGroup.style.display = settings.musicMode === 'test' ? 'block' : 'none';
    }
    
    _saveSettings() {
        const newSettings = {
            difficulty: document.getElementById('difficultySelect').value,
            musicMode: document.getElementById('modeSelect').value,
            currentTest: document.getElementById('testSelect').value,
            playerColor: document.getElementById('playerColorInput').value,
            obstacleColor: document.getElementById('obstacleColorInput').value,
            confidenceThreshold: parseFloat(document.getElementById('thresholdSlider').value)
        };
        
        gameSettings.setMultiple(newSettings);
    }
    
    open() {
        this.isOpen = true;
        this._loadCurrentSettings();
        this.panel.classList.remove('hidden');
    }
    
    close() {
        this.isOpen = false;
        this.panel.classList.add('hidden');
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
}

