// SRP: only handles drawing to canvas
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // set canvas size
        this.canvas.width = GameConfig.CANVAS_WIDTH;
        this.canvas.height = GameConfig.CANVAS_HEIGHT;
    }
    
    clear() {
        // sky
        this.ctx.fillStyle = GameConfig.COLOR_SKY;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // ground line
        const groundY = GameConfig.PLAYER_GROUND_Y + GameConfig.PLAYER_HEIGHT;
        this.ctx.strokeStyle = GameConfig.COLOR_GROUND;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, groundY);
        this.ctx.lineTo(this.canvas.width, groundY);
        this.ctx.stroke();
    }
    
    drawPlayer(player) {
        const bounds = player.getBounds();
        
        this.ctx.fillStyle = GameConfig.COLOR_PLAYER;
        this.ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
        
        // add some style - simple face
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(bounds.x + 10, bounds.y + 15, 5, 5); // eye
        this.ctx.fillRect(bounds.x + 25, bounds.y + 15, 5, 5); // eye
    }
    
    drawObstacle(obstacle) {
        const bounds = obstacle.getBounds();
        
        this.ctx.fillStyle = GameConfig.COLOR_OBSTACLE;
        this.ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    
    drawObstacles(obstacles) {
        obstacles.forEach(obstacle => this.drawObstacle(obstacle));
    }
    
    render(player, obstacles) {
        this.clear();
        this.drawPlayer(player);
        this.drawObstacles(obstacles);
    }
}

