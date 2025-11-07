// centralized settings management using singleton pattern - one source of truth across the entire game
// storing in localStorage bc we want settings to persist between sessions
export class GameSettings {
    constructor() {
        if (GameSettings.instance) {
            return GameSettings.instance;
        }
        
        this.settings = this._loadSettings();
        GameSettings.instance = this;
    }
    
    _loadSettings() {
        const saved = localStorage.getItem('flutevision_settings');
        if (saved) {
            return { ...this._getDefaults(), ...JSON.parse(saved) };
        }
        return this._getDefaults();
    }
    
    _getDefaults() {
        return {
            // game settings
            visionMode: 'flute', // 'flute' or 'hand'
            character: 'cat', // 'cat', 'dog', 'bear', 'fox', 'owl', 'frog'
            theme: 'forest', // 'forest', 'garden', 'beach', 'peak', 'park', 'night'
            
            // visual customization
            playerImage: null, // null means use default rectangle
            backgroundImage: null,
            playerColor: '#667eea',
            obstacleColor: '#ef4444',
            
            // gameplay
            difficulty: 'medium', // easy, medium, hard
            musicMode: 'random', // random or test
            currentTest: null, // name of selected musical test
            
            // audio
            soundEnabled: true,
            musicEnabled: false,
            
            // accessibility
            confidenceThreshold: 0.7,
            gestureChangeInterval: 5000
        };
    }
    
    get(key) {
        return this.settings[key];
    }
    
    set(key, value) {
        this.settings[key] = value;
        this._save();
    }
    
    getAll() {
        return { ...this.settings };
    }
    
    setMultiple(updates) {
        this.settings = { ...this.settings, ...updates };
        this._save();
    }
    
    reset() {
        this.settings = this._getDefaults();
        this._save();
    }
    
    _save() {
        localStorage.setItem('flutevision_settings', JSON.stringify(this.settings));
    }
}

// export singleton instance
export const gameSettings = new GameSettings();

