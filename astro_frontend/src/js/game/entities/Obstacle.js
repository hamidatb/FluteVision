// obstacle entity - knows how to move and draw itself
class Obstacle {
    constructor(x, groundY, speed) {
        this.x = x;
        this.groundY = groundY;
        this.speed = speed;
        
        // randomize size for variety bc playing against identical obstacles is boring
        this.width = this._randomRange(
            GameConstants.OBSTACLE_MIN_WIDTH,
            GameConstants.OBSTACLE_MAX_WIDTH
        );
        this.height = this._randomRange(
            GameConstants.OBSTACLE_MIN_HEIGHT,
            GameConstants.OBSTACLE_MAX_HEIGHT
        );
        
        this.y = groundY - this.height;
    }
    
    update() {
        this.x -= this.speed;
    }
    
    render(ctx) {
        ctx.fillStyle = gameSettings.get('obstacleColor');
        ctx.fillRect(this.x, this.y, this.width, this.height);
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

