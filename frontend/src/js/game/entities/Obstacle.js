import { GameConstants } from '../../game/config/GameConstants';
import { gameSettings } from '../../game/config/GameSettings';

// obstacle entity - knows how to move and draw itself
export class Obstacle {
    constructor(x, groundY, speed, imageManager = null, obstacleImagePath = null, gesture = null) {
        this.x = x;
        this.groundY = groundY;
        this.speed = speed;
        this.imageManager = imageManager;
        this.obstacleImagePath = obstacleImagePath;
        this.gesture = gesture; // letter to display on obstacle
        
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
        // just aligning the top of the image to the top of the obstacle box
        if (!this.imageManager || !this.obstacleImagePath) return;

        const img = this.imageManager.getImage(this.obstacleImagePath);
        if (!img) return;

        // preserve aspect ratio
        const aspect = img.width / img.height;

        // fit the image to the obstacles width, not height
        const targetWidth = this.width;
        const targetHeight = targetWidth / aspect;

        // align the TOP of the image with the TOP of the obstacle
        const topY = this.y;

        // draw the image anchored by its top
        ctx.drawImage(img, this.x, topY, targetWidth, targetHeight);
        
        // display gesture text if available (so player can see what's coming)
        if (this.gesture) {
            ctx.save();
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // white text with black outline for visibility
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 4;
            ctx.fillStyle = 'white';
            
            const textX = this.x + this.width / 2;
            const textY = this.y + this.height / 2;
            
            ctx.strokeText(this.gesture, textX, textY);
            ctx.fillText(this.gesture, textX, textY);
            ctx.restore();
        }
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

