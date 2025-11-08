import { GameConstants } from '../../game/config/GameConstants';

// rendering system - handles all drawing operations
// separated bc rendering logic should be independent of game logic
export class RenderSystem {
    constructor(canvas, assetManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.assetManager = assetManager;
        
        this.canvas.width = GameConstants.CANVAS_WIDTH;
        this.canvas.height = GameConstants.CANVAS_HEIGHT;
        
        // Default theme colors
        this.theme = {
            skyColor: GameConstants.COLOR_SKY,
            groundColor: GameConstants.COLOR_GROUND
        };
    }
    
    setTheme(theme) {
        // Update rendering colors based on selected theme
        this.theme = {
            skyColor: theme.skyColor,
            groundColor: theme.groundColor,
            obstacleColor: theme.obstacleColor,
            playerColor: theme.playerColor
        };
    }
    
    clear() {
        const bgImage = this.assetManager.getImage('background');
        
        if (bgImage) {
            // draw tiled background if custom image loaded
            this.ctx.drawImage(bgImage, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            // use theme sky color
            this.ctx.fillStyle = this.theme.skyColor;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // ground - draw thick ground with theme color
        const groundY = GameConstants.PLAYER_GROUND_Y + GameConstants.PLAYER_HEIGHT;
        const groundHeight = this.canvas.height - groundY;
        this.ctx.fillStyle = this.theme.groundColor;
        this.ctx.fillRect(0, groundY, this.canvas.width, groundHeight);
        
        // ground line on top for definition
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(0, groundY);
        this.ctx.lineTo(this.canvas.width, groundY);
        this.ctx.stroke();
    }
    
    render(player, obstacles, isInvulnerable = false) {
        this.clear();
        
        // flash player when invulnerable (alternating visibility)
        if (!isInvulnerable || Math.floor(Date.now() / 150) % 2 === 0) {
            player.render(this.ctx);
        }
        
        obstacles.forEach(obstacle => obstacle.render(this.ctx));
    }
}

