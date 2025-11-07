import { GameConstants } from '../../game/config/GameConstants';
import { CollisionSystem } from '../../game/systems/CollisionSystem';

// rendering system - handles all drawing operations
// separated bc rendering logic should be independent of game logic
export class RenderSystem {
    constructor(canvas, assetManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.assetManager = assetManager;
        
        this.canvas.width = GameConstants.CANVAS_WIDTH;
        this.canvas.height = GameConstants.CANVAS_HEIGHT;
    }
    
    clear() {
        const bgImage = this.assetManager.getImage('background');
        
        if (bgImage) {
            // draw tiled background if custom image loaded
            this.ctx.drawImage(bgImage, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            // default sky color
            this.ctx.fillStyle = GameConstants.COLOR_SKY;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // ground line - always draw this bc it helps orient the player
        const groundY = GameConstants.PLAYER_GROUND_Y + GameConstants.PLAYER_HEIGHT;
        this.ctx.strokeStyle = GameConstants.COLOR_GROUND;
        this.ctx.lineWidth = 2;
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

