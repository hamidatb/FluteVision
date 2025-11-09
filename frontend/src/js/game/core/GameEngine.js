import { Player } from '../../game/entities/Player';
import { Obstacle } from '../../game/entities/Obstacle';
import { GameConstants } from '../../game/config/GameConstants';
import { gameSettings } from '../../game/config/GameSettings';
import { getTheme, getDefaultTheme } from '../../game/config/ThemeConfig';
import { RenderSystem } from '../../game/systems/RenderSystem';
import { CollisionSystem } from '../../game/systems/CollisionSystem';
import { ScoreManager } from '../../game/managers/ScoreManager';

// core game loop and state - the heart of the game
// handles update/render cycle and coordinates all systems
export class GameEngine {
    constructor(canvas, imageManager) {
        this.imageManager = imageManager;
        
        // entities
        this.player = new Player(
            GameConstants.PLAYER_X,
            GameConstants.PLAYER_GROUND_Y,
            imageManager
        );
        this.obstacles = [];
        
        // systems
        this.renderSystem = new RenderSystem(canvas, imageManager);
        this.collisionSystem = new CollisionSystem();
        this.scoreManager = new ScoreManager();
        
        // state
        this.isRunning = false;
        this.isPaused = false;
        this.animationFrameId = null;
        
        // timing
        this.startTime = 0;
        this.elapsedTime = 0;
        this.lastObstacleTime = 0;
        this.frameCount = 0;
        
        // difficulty
        const difficulty = gameSettings.get('difficulty');
        this.difficultySettings = GameConstants.getDifficultySettings(difficulty);
        this.gameSpeed = this.difficultySettings.speed;
        
        // musical test mode
        this.musicalTest = null;
        this.testMode = false;
        this.processedNotes = new Set(); // track which notes we've spawned obstacles for
        this.testCompleted = false;
        
        // lives system
        this.lives = 3;
        this.maxLives = 3;
        this.invulnerable = false;
        this.invulnerabilityTime = 2000; // 2 seconds of invulnerability after getting hit
        
        // theme assets
        const themeName = gameSettings.get('theme');
        const theme = getTheme(themeName) || getDefaultTheme();
        this.currentObstacleImage = theme.obstacleImage;
        
        // callbacks
        this.onGameOver = null;
        this.onScoreUpdate = null;
        this.onNoteChange = null; // tells UI what gesture to show
        this.onLivesUpdate = null; // tells UI when lives change
        this.onTestComplete = null; // tells UI when test is finished
    }
    
    setMusicalTest(test) {
        // switch to musical test mode - spawns obstacles at specific times matching the piece
        this.musicalTest = test;
        this.testMode = test !== null;
        this.processedNotes.clear();
        this.testCompleted = false;
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;
        this.startTime = Date.now();
        this.elapsedTime = 0;
        this._gameLoop();
    }
    
    pause() {
        this.isPaused = true;
    }
    
    resume() {
        this.isPaused = false;
        // adjust start time to account for pause bc we don't want the timer to keep running
        this.startTime = Date.now() - this.elapsedTime;
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
        this.gameSpeed = this.difficultySettings.speed;
        this.frameCount = 0;
        this.lastObstacleTime = 0;
        this.elapsedTime = 0;
        this.processedNotes.clear();
        this.testCompleted = false;
        this.lives = this.maxLives;
        this.invulnerable = false;
        
        if (this.onScoreUpdate) {
            this.onScoreUpdate(0, this.scoreManager.getHighScore(), 0);
        }
        
        if (this.onLivesUpdate) {
            this.onLivesUpdate(this.lives, this.maxLives);
        }
    }
    
    makePlayerJump() {
        this.player.jump();
    }
    
    _gameLoop() {
        if (!this.isRunning || this.isPaused) return;
        
        this.elapsedTime = Date.now() - this.startTime;
        this._update();
        this._render();
        
        this.animationFrameId = requestAnimationFrame(() => this._gameLoop());
    }
    
    _update() {
        this.frameCount++;
        
        this.player.update();
        
        // spawn obstacles based on mode
        if (this.testMode) {
            this._spawnMusicalObstacles();
        } else {
            this._spawnRandomObstacles();
        }
        
        this.obstacles.forEach(obstacle => obstacle.update());
        
        // remove off-screen obstacles
        this.obstacles = this.obstacles.filter(obstacle => {
            if (obstacle.isOffScreen()) {
                this.scoreManager.addPoint();
                this.scoreManager.incrementCombo();
                
                if (this.onScoreUpdate) {
                    this.onScoreUpdate(
                        this.scoreManager.getScore(),
                        this.scoreManager.getHighScore(),
                        this.scoreManager.getCombo()
                    );
                }
                return false;
            }
            return true;
        });
        
        // check if test is complete
        if (this.testMode && !this.testCompleted) {
            this._checkTestCompletion();
        }
        
        // check collisions
        if (!this.invulnerable) {
            const hitObstacle = this.collisionSystem.checkPlayerObstacleCollision(
                this.player, 
                this.obstacles
            );
            
            if (hitObstacle) {
                this._handleCollision(hitObstacle);
            }
        }
        
        // update difficulty in random mode
        if (!this.testMode) {
            this._updateDifficulty();
        }
    }
    
    _spawnRandomObstacles() {
        // traditional runner game spawning - periodic with slight randomness
        if (this.elapsedTime - this.lastObstacleTime > this.difficultySettings.spawnInterval) {
            this._createObstacle();
            this.lastObstacleTime = this.elapsedTime;
        }
    }
    
    _spawnMusicalObstacles() {
        // spawn obstacles timed to musical notes
        if (!this.musicalTest) return;
        
        const notes = this.musicalTest.notes;
        
        for (const note of notes) {
            // check if it's time to spawn this note's obstacle
            // spawn ahead of time so it reaches player at the correct moment
            const spawnLeadTime = 2000; // spawn 2s before player should play the note
            const spawnTime = note.time - spawnLeadTime;
            
            const noteId = `${note.gesture}-${note.time}`;
            
            if (this.elapsedTime >= spawnTime && !this.processedNotes.has(noteId)) {
                this._createObstacle();
                this.processedNotes.add(noteId);
                
                // notify UI to show this gesture as target
                if (this.onNoteChange) {
                    this.onNoteChange(note.gesture, note.time);
                }
            }
        }
    }
    
    _createObstacle() {
        const obstacle = new Obstacle(
            GameConstants.CANVAS_WIDTH,
            GameConstants.PLAYER_GROUND_Y, // obstacles align with player's ground level
            this.gameSpeed,
            this.imageManager,
            this.currentObstacleImage
        );
        this.obstacles.push(obstacle);
    }
    
    setTheme(themeName) {
        // update the obstacle image path when theme changes
        const theme = getTheme(themeName) || getDefaultTheme();
        this.currentObstacleImage = theme.obstacleImage;
    }
    
    _updateDifficulty() {
        // gradually ramp up speed bc playing the same speed forever is boring
        if (this.gameSpeed < this.difficultySettings.maxSpeed) {
            this.gameSpeed += this.difficultySettings.speedIncrease;
            
            this.obstacles.forEach(obstacle => {
                obstacle.speed = this.gameSpeed;
            });
        }
    }
    
    _render() {
        this.renderSystem.render(this.player, this.obstacles, this.invulnerable);
    }
    
    _handleCollision(hitObstacle) {
        // remove the obstacle that was hit
        this.obstacles = this.obstacles.filter(obs => obs !== hitObstacle);
        
        // lose a life
        this.lives--;
        this.scoreManager.resetCombo();
        
        // notify UI about lives change
        if (this.onLivesUpdate) {
            this.onLivesUpdate(this.lives, this.maxLives);
        }
        
        // check if game over
        if (this.lives <= 0) {
            this._handleGameOver();
        } else {
            // give temporary invulnerability
            this.invulnerable = true;
            setTimeout(() => {
                this.invulnerable = false;
            }, this.invulnerabilityTime);
        }
    }
    
    _checkTestCompletion() {
        if (!this.musicalTest) return;
        
        const totalNotes = this.musicalTest.notes.length;
        const allNotesSpawned = this.processedNotes.size === totalNotes;
        const noObstaclesLeft = this.obstacles.length === 0;
        
        // test is complete when all notes spawned and all obstacles cleared
        if (allNotesSpawned && noObstaclesLeft) {
            this.testCompleted = true;
            this.stop();
            
            if (this.onTestComplete) {
                // notes hit = total notes - lives lost (each miss = 1 life lost)
                const livesLost = this.maxLives - this.lives;
                const notesHit = totalNotes - livesLost;
                const accuracy = totalNotes > 0 ? Math.round((notesHit / totalNotes) * 100) : 100;
                
                this.onTestComplete({
                    testName: this.musicalTest.name,
                    score: this.scoreManager.getScore(),
                    maxCombo: this.scoreManager.maxCombo,
                    accuracy: accuracy,
                    notesHit: notesHit,
                    totalNotes: totalNotes,
                    duration: this.musicalTest.getTotalDuration()
                });
            }
        }
    }
    
    _handleGameOver() {
        this.stop();
        if (this.onGameOver) {
            this.onGameOver(
                this.scoreManager.getScore(),
                this.scoreManager.getCombo(),
                this.scoreManager.maxCombo
            );
        }
    }
}

