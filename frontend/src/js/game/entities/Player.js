// player entity - separated bc entities should only know about themselves
// SRP: only handles player state, physics, and rendering itself
class Player {
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
        } else {
            // fallback to colored rectangle with face
            ctx.fillStyle = gameSettings.get('playerColor');
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

