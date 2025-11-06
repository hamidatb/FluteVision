// UI for game settings - separated bc UI concerns shouldn't mix with game logic
export class SettingsUI {
    constructor(assetManager, testLibrary) {
        this.assetManager = assetManager;
        this.testLibrary = testLibrary;
        this.isOpen = false;
        
        // bind methods to preserve 'this' context bc javascript is weird about scope
        this.open = this.open.bind(this);
        this.close = this.close.bind(this);
        this.toggle = this.toggle.bind(this);
        this._saveSettings = this._saveSettings.bind(this);
        
        this._createSettingsPanel();
        this._attachEventListeners();
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
                
                <div class="setting-group">
                    <label>Upload Custom Test (JSON):</label>
                    <input type="file" id="testUploadInput" accept=".json">
                    <small style="color: #666; display: block; margin-top: 5px;">
                        Upload a JSON file with your custom musical test
                    </small>
                </div>
                
                <div class="settings-buttons">
                    <button id="saveSettings" class="game-btn">Save</button>
                    <button id="closeSettings" class="game-btn secondary">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.panel = panel;
        
        // force it to start hidden bc we don't want it popping up immediately
        this.panel.style.display = 'none';
        
        // click outside to close bc it's intuitive UX
        panel.addEventListener('click', (e) => {
            if (e.target === panel) {
                this.close();
            }
        });
    }
    
    _attachEventListeners() {
        // using event delegation on the panel bc dynamically created elements can be tricky
        this.panel.addEventListener('click', (e) => {
            const target = e.target;
            
            // handle save button
            if (target.id === 'saveSettings') {
                e.preventDefault();
                e.stopPropagation();
                console.log('Save button clicked');
                this._saveSettings();
                this.close();
                return;
            }
            
            // handle close button
            if (target.id === 'closeSettings') {
                e.preventDefault();
                e.stopPropagation();
                console.log('Close button clicked');
                this.close();
                return;
            }
            
            // handle clear buttons
            if (target.id === 'clearPlayerImage') {
                this.assetManager.images.delete('player');
                document.getElementById('playerImageInput').value = '';
                return;
            }
            
            if (target.id === 'clearBackground') {
                this.assetManager.images.delete('background');
                document.getElementById('backgroundImageInput').value = '';
                return;
            }
        });
        
        // mode select shows/hides test group
        this.panel.addEventListener('change', (e) => {
            if (e.target.id === 'modeSelect') {
                const testGroup = document.getElementById('testGroup');
                testGroup.style.display = e.target.value === 'test' ? 'block' : 'none';
            }
            
            // threshold slider
            if (e.target.id === 'thresholdSlider') {
                const value = (parseFloat(e.target.value) * 100).toFixed(0);
                document.getElementById('thresholdValue').textContent = `${value}%`;
            }
        });
        
        // slider input event (for live updates)
        this.panel.addEventListener('input', (e) => {
            if (e.target.id === 'thresholdSlider') {
                const value = (parseFloat(e.target.value) * 100).toFixed(0);
                document.getElementById('thresholdValue').textContent = `${value}%`;
            }
        });
        
        // file inputs
        this.panel.addEventListener('change', async (e) => {
            if (e.target.id === 'playerImageInput' && e.target.files[0]) {
                await this.assetManager.loadFromFile('player', e.target.files[0]);
            }
            
            if (e.target.id === 'backgroundImageInput' && e.target.files[0]) {
                await this.assetManager.loadFromFile('background', e.target.files[0]);
            }
            
            if (e.target.id === 'testUploadInput' && e.target.files[0]) {
                await this._loadCustomTest(e.target.files[0]);
            }
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
    
    async _loadCustomTest(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // validate the format
            if (!data.name || !data.notes || !Array.isArray(data.notes)) {
                alert('Invalid test format. Must have "name" and "notes" array.');
                return;
            }
            
            // add to library
            await this.testLibrary.loadFromJson(data);
            
            // refresh the test dropdown
            this._loadCurrentSettings();
            
            alert(`Test "${data.name}" loaded successfully!`);
        } catch (error) {
            alert(`Error loading test: ${error.message}`);
            console.error('Test load error:', error);
        }
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
        console.log('Opening settings panel');
        this.isOpen = true;
        this._loadCurrentSettings();
        this.panel.classList.remove('hidden');
        // force display bc sometimes CSS doesn't apply
        this.panel.style.display = 'flex';
    }
    
    close() {
        console.log('Closing settings panel');
        this.isOpen = false;
        this.panel.classList.add('hidden');
        // force hide bc we really want it gone
        this.panel.style.display = 'none';
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
}

