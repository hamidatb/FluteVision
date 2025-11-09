import { GameConstants } from '../../game/config/GameConstants';
import { gameSettings } from '../../game/config/GameSettings';

// player entity - separated bc entities should only know about themselves
// SRP: only handles player state, physics, and rendering itself
export class Player {
    constructor(x, groundY, imageManager) {
        this.x = x;
        this.groundY = groundY;
        this.width = GameConstants.PLAYER_WIDTH;
        this.height = GameConstants.PLAYER_HEIGHT;
        // the chars y position is top-left, so subtract height to make feet touch ground
        this.y = groundY - this.height;
        
        this.velocityY = 0;
        this.isJumping = false;
        this.canJump = true;
        
        this.imageManager = imageManager;
        this.characterKey = '🐱'; // default fallback (emoji)
    }
    
    setCharacter(characterKey) {
        this.characterKey = characterKey; 
    }
    
    
    jump() {
        // allow jump even if slightly above ground for more responsive rapid jumps
        const playerBottom = this.y + this.height;
        const nearGround = playerBottom >= this.groundY - 5;
        if (!this.canJump && !nearGround) return;
        
        this.velocityY = GameConstants.JUMP_VELOCITY;
        this.isJumping = true;
        this.canJump = false;
    }
    
    update() {
        // apply gravity
        this.velocityY += GameConstants.GRAVITY;
        this.y += this.velocityY;
        
        // ground collision - player's bottom (y + height) should not go below ground
        const playerBottom = this.y + this.height;
        if (playerBottom >= this.groundY) {
            this.y = this.groundY - this.height;
            this.velocityY = 0;
            this.isJumping = false;
            this.canJump = true;
        }
    }
    
    render(ctx) {
        // Select image based on jumping state - show jump image when player is in the air
        const playerBottom = this.y + this.height;
        const isInAir = playerBottom < this.groundY;
        const imageKey = isInAir ? `${this.characterKey}_jump` : this.characterKey;
        const img = this.imageManager.getImage(imageKey) || this.imageManager.getImage(this.characterKey);
        
        if (img) {
            // draw custom image as the char icon
            const imgWidth = img.naturalWidth || img.width;
            const imgHeight = img.naturalHeight || img.height;
            
            // Calculate scale to fit within player bounds while maintaining aspect ratio
            const scaleX = this.width / imgWidth;
            const scaleY = this.height / imgHeight;
            const scale = Math.min(scaleX, scaleY); // Use smaller scale to fit within bounds
            
            const drawWidth = imgWidth * scale;
            const drawHeight = imgHeight * scale;
            
            // aliggn image to bottom of player bounds, centered horizontally
            const drawX = this.x + (this.width - drawWidth) / 2;
            const drawY = this.y + this.height - drawHeight; // bottom-aligned
            
            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        } else if (this.characterKey) {
            // draw character emoji without stretching
            const emojiSize = this.width;
            ctx.font = `${emojiSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Center the emoji within the player bounds
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            ctx.fillText(this.characterKey, centerX, centerY);
            // Reset text align for other rendering
            ctx.textAlign = 'start';
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
        this.y = this.groundY - this.height;
        this.velocityY = 0;
        this.isJumping = false;
        this.canJump = true;
    }
}

