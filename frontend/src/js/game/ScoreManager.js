// SRP: manages score and high score persistence
class ScoreManager {
    constructor() {
        this.score = 0;
        this.highScore = this._loadHighScore();
    }
    
    addPoint() {
        this.score++;
        
        // update high score if beaten
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this._saveHighScore();
        }
    }
    
    getScore() {
        return this.score;
    }
    
    getHighScore() {
        return this.highScore;
    }
    
    reset() {
        this.score = 0;
    }
    
    _loadHighScore() {
        const saved = localStorage.getItem('flutevision_highscore');
        return saved ? parseInt(saved, 10) : 0;
    }
    
    _saveHighScore() {
        localStorage.setItem('flutevision_highscore', this.highScore.toString());
    }
}

