// score tracking and persistence
// keeping this as a manager bc it's a cross-cutting concern that multiple systems need
export class ScoreManager {
    constructor() {
        this.score = 0;
        this.highScore = this._loadHighScore();
        this.combo = 0; // track consecutive correct notes
        this.maxCombo = 0;
    }
    
    addPoint(points = 1) {
        this.score += points;
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this._saveHighScore();
        }
    }
    
    incrementCombo() {
        this.combo++;
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }
    }
    
    resetCombo() {
        this.combo = 0;
    }
    
    getScore() {
        return this.score;
    }
    
    getHighScore() {
        return this.highScore;
    }
    
    getCombo() {
        return this.combo;
    }
    
    reset() {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
    }
    
    _loadHighScore() {
        const saved = localStorage.getItem('flutevision_highscore');
        return saved ? parseInt(saved, 10) : 0;
    }
    
    _saveHighScore() {
        localStorage.setItem('flutevision_highscore', this.highScore.toString());
    }
}

