// SRP: only handles player state and physics
class Player {
    constructor(x, groundY) {
        this.x = x;
        this.groundY = groundY;
        this.y = groundY;
        this.width = GameConfig.PLAYER_WIDTH;
        this.height = GameConfig.PLAYER_HEIGHT;
        
        this.velocityY = 0;
        this.isJumping = false;
        this.canJump = true; // prevents double jumping
    }
    
    jump() {
        if (!this.canJump) return;
        
        this.velocityY = GameConfig.JUMP_VELOCITY;
        this.isJumping = true;
        this.canJump = false;
    }
    
    update() {
        // apply gravity
        this.velocityY += GameConfig.GRAVITY;
        this.y += this.velocityY;
        
        // ground collision
        if (this.y >= this.groundY) {
            this.y = this.groundY;
            this.velocityY = 0;
            this.isJumping = false;
            this.canJump = true;
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

