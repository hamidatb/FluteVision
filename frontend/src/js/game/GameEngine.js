// SRP: core game loop and state management
class GameEngine {
    constructor(canvas, availableGestures) {
        this.player = new Player(
            GameConfig.PLAYER_X, 
            GameConfig.PLAYER_GROUND_Y
        );
        this.obstacles = [];
        this.renderer = new Renderer(canvas);
        this.collisionDetector = new CollisionDetector();
        this.scoreManager = new ScoreManager();
        
        this.isRunning = false;
        this.isPaused = false;
        this.animationFrameId = null;
        
        this.lastObstacleTime = 0;
        this.gameSpeed = GameConfig.OBSTACLE_SPEED;
        this.frameCount = 0;
        
        this.onGameOver = null;
        this.onScoreUpdate = null;
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;
        this._gameLoop();
    }
    
    pause() {
        this.isPaused = true;
    }
    
    resume() {
        this.isPaused = false;
        this._gameLoop();
    }
    
    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }
    
    reset() {
        this.obstacles = [];
        this.player.reset();
        this.scoreManager.reset();
        this.gameSpeed = GameConfig.OBSTACLE_SPEED;
        this.frameCount = 0;
        this.lastObstacleTime = 0;
        
        if (this.onScoreUpdate) {
            this.onScoreUpdate(0, this.scoreManager.getHighScore());
        }
    }
    
    makePlayerJump() {
        this.player.jump();
    }
    
    _gameLoop() {
        if (!this.isRunning || this.isPaused) return;
        
        this._update();
        this._render();
        
        this.animationFrameId = requestAnimationFrame(() => this._gameLoop());
    }
    
    _update() {
        this.frameCount++;
        
        // update player physics
        this.player.update();
        
        // spawn obstacles periodically
        this._spawnObstacles();
        
        // update obstacles
        this.obstacles.forEach(obstacle => obstacle.update());
        
        // remove off-screen obstacles and award points
        this.obstacles = this.obstacles.filter(obstacle => {
            if (obstacle.isOffScreen()) {
                this.scoreManager.addPoint();
                if (this.onScoreUpdate) {
                    this.onScoreUpdate(
                        this.scoreManager.getScore(),
                        this.scoreManager.getHighScore()
                    );
                }
                return false;
            }
            return true;
        });
        
        // check collisions
        if (this.collisionDetector.checkPlayerCollision(this.player, this.obstacles)) {
            this._handleGameOver();
        }
        
        // gradually increase difficulty
        this._updateDifficulty();
    }
    
    _render() {
        this.renderer.render(this.player, this.obstacles);
    }
    
    _spawnObstacles() {
        const now = Date.now();
        
        // spawn based on interval
        if (now - this.lastObstacleTime > GameConfig.OBSTACLE_SPAWN_INTERVAL) {
            const obstacle = new Obstacle(
                GameConfig.CANVAS_WIDTH,
                GameConfig.PLAYER_GROUND_Y + GameConfig.PLAYER_HEIGHT,
                this.gameSpeed
            );
            this.obstacles.push(obstacle);
            this.lastObstacleTime = now;
        }
    }
    
    _updateDifficulty() {
        // gradually increase speed
        if (this.gameSpeed < GameConfig.MAX_SPEED) {
            this.gameSpeed += GameConfig.SPEED_INCREASE_RATE;
            
            // apply to all obstacles
            this.obstacles.forEach(obstacle => {
                obstacle.speed = this.gameSpeed;
            });
        }
    }
    
    _handleGameOver() {
        this.stop();
        if (this.onGameOver) {
            this.onGameOver(this.scoreManager.getScore());
        }
    }
}

