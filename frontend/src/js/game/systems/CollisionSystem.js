// collision detection system - operates on entities but doesn't own them
// using system pattern bc collision detection is a behavior that works on multiple entities
export class CollisionSystem {
    // axis-aligned bounding box collision - fast and good enough for this game
    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    checkPlayerObstacleCollision(player, obstacles) {
        const playerBounds = player.getBounds();
        
        for (const obstacle of obstacles) {
            if (this.checkCollision(playerBounds, obstacle.getBounds())) {
                return obstacle; // return which obstacle hit
            }
        }
        
        return null;
    }
}

