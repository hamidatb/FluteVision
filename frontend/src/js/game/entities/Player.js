import { GameConstants } from '../../game/config/GameConstants';
import { gameSettings } from '../../game/config/GameSettings';

// player entity - separated bc entities should only know about themselves
// SRP: only handles player state, physics, and rendering itself
export class Player {
    constructor(x, groundY, assetManager) {
        this.x = x;
        this.groundY = groundY;
        this.y = groundY;
        this.width = GameConstants.PLAYER_WIDTH;
        this.height = GameConstants.PLAYER_HEIGHT;
        
        this.velocityY = 0;
        this.isJumping = false;
        this.canJump = true;
        
        this.assetManager = assetManager;
        this.character = '🐱'; // default character
        this.themeColor = gameSettings.get('playerColor'); // default color
    }
    
    setCharacter(character) {
        this.character = character;
    }
    
    setColor(color) {
        this.themeColor = color;
    }
    
    jump() {
        if (!this.canJump) return;
        
        this.velocityY = GameConstants.JUMP_VELOCITY;
        this.isJumping = true;
        this.canJump = false;
    }
    
    update() {
        // apply gravity
        this.velocityY += GameConstants.GRAVITY;
        this.y += this.velocityY;
        
        // ground collision
        if (this.y >= this.groundY) {
            this.y = this.groundY;
            this.velocityY = 0;
            this.isJumping = false;
            this.canJump = true;
        }
    }
    
    render(ctx) {
        const playerImage = this.assetManager.getImage('player');
        
        if (playerImage) {
            // draw custom image if loaded
            ctx.drawImage(playerImage, this.x, this.y, this.width, this.height);
        } else if (this.character) {
            // draw character emoji without stretching
            // Use width as base size since emojis are naturally square
            const emojiSize = this.width;
            ctx.font = `${emojiSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Center the emoji within the player bounds
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            ctx.fillText(this.character, centerX, centerY);
            // Reset text align for other rendering
            ctx.textAlign = 'start';
        } else {
            // fallback to colored rectangle with face
            ctx.fillStyle = this.themeColor;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            
            // simple face so it's not just a box
            ctx.fillStyle = 'white';
            ctx.fillRect(this.x + 10, this.y + 15, 5, 5);
            ctx.fillRect(this.x + 25, this.y + 15, 5, 5);
        }
    }
    
    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
    
    reset() {
        this.y = this.groundY;
        this.velocityY = 0;
        this.isJumping = false;
        this.canJump = true;
    }
}

