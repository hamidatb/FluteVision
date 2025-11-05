// SRP: only responsible for detecting collisions
class CollisionDetector {
    // AABB collision detection
    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    // check player against all obstacles
    checkPlayerCollision(player, obstacles) {
        const playerBounds = player.getBounds();
        
        for (const obstacle of obstacles) {
            if (this.checkCollision(playerBounds, obstacle.getBounds())) {
                return true;
            }
        }
        
        return false;
    }
}

