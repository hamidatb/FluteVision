// SRP: handles obstacle movement and properties
class Obstacle {
    constructor(x, groundY, speed) {
        this.x = x;
        this.groundY = groundY;
        this.speed = speed;
        
        // randomize size for variety
        this.width = this._randomRange(
            GameConfig.OBSTACLE_MIN_WIDTH,
            GameConfig.OBSTACLE_MAX_WIDTH
        );
        this.height = this._randomRange(
            GameConfig.OBSTACLE_MIN_HEIGHT,
            GameConfig.OBSTACLE_MAX_HEIGHT
        );
        
        this.y = groundY - this.height;
    }
    
    update() {
        this.x -= this.speed;
    }
    
    isOffScreen() {
        return this.x + this.width < 0;
    }
    
    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
    
    _randomRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

