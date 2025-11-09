import { GameConstants } from '../../game/config/GameConstants';

// rendering system - handles all drawing operations
// separated bc rendering logic should be independent of game logic
export class RenderSystem {
    constructor(canvas, imageManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.imageManager = imageManager;
        
        this.canvas.width = GameConstants.CANVAS_WIDTH;
        this.canvas.height = GameConstants.CANVAS_HEIGHT;
        
        // Default theme colors
        this.theme = {
            skyColor: GameConstants.COLOR_SKY,
            groundColor: GameConstants.COLOR_GROUND
        };
    }
    
    setTheme(theme) {
        // Update rendering colors and asset paths based on selected theme
        this.theme = {
            backgroundImage: theme.backgroundImage,
            groundImage: theme.groundImage,
            obstacleImage: theme.obstacleImage
        };
    }
    
    clear() {
        // try to get theme-specific background image, fallback to 'background' key
        const bgImage = this.imageManager.getImage(this.theme.backgroundImage) || 
                       this.imageManager.getImage('background');
        
        // draw background image stretched to canvas
        this.ctx.drawImage(bgImage, 0, 0, this.canvas.width, this.canvas.height);
        
        // Ground is drawn at PLAYER_GROUND_Y (where player's feet are)
        const groundY = GameConstants.PLAYER_GROUND_Y;
        const groundHeight = this.canvas.height - groundY;
        
        const groundImage = this.imageManager.getImage(this.theme.groundImage)
        this.ctx.drawImage(groundImage, 0, groundY, this.canvas.width, groundHeight);
        
        
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

