import { getDefaultThemeName } from './ThemeConfig';

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
            const parsed = JSON.parse(saved);
            const defaults = this._getDefaults();
            
            if (parsed.confidenceThreshold === 0.7 || parsed.confidenceThreshold > 0.5) {
                parsed.confidenceThreshold = defaults.confidenceThreshold;
                // Save the migrated value back to localStorage
                localStorage.setItem('flutevision_settings', JSON.stringify({ ...defaults, ...parsed }));
            }
            
            return { ...defaults, ...parsed };
        }
        return this._getDefaults();
    }
    
    _getDefaults() {
        return {
            // game settings
            visionMode: 'flute', // 'flute' or 'hand'
            character: 'Hami', 
            theme: getDefaultThemeName(),
            
            // gameplay
            difficulty: 'medium', 
            musicMode: 'random', 
            currentTest: null, // name of selected musical test
            
            // audio
            soundEnabled: true,
            musicEnabled: false,
            
            // accessibility
            confidenceThreshold: 0.35,
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

