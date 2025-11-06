// immutable game constants - things that define core mechanics and shouldn't change during gameplay
// separated from settings bc settings are user-configurable but constants are system-level
class GameConstants {
    // canvas
    static CANVAS_WIDTH = 800;
    static CANVAS_HEIGHT = 300;
    
    // player physics - tuned these values to feel good, like the chrome dino
    static PLAYER_WIDTH = 40;
    static PLAYER_HEIGHT = 60;
    static PLAYER_X = 100; // fixed x position bc it's a runner game
    static PLAYER_GROUND_Y = 200;
    static JUMP_VELOCITY = -12; // negative bc y increases downward
    static GRAVITY = 0.6; // feels natural, not too floaty
    
    // obstacle generation
    static OBSTACLE_MIN_WIDTH = 20;
    static OBSTACLE_MAX_WIDTH = 40;
    static OBSTACLE_MIN_HEIGHT = 30;
    static OBSTACLE_MAX_HEIGHT = 80;
    
    // difficulty presets - using object bc it's easier to extend
    static DIFFICULTY_PRESETS = {
        easy: {
            speed: 4,
            spawnInterval: 2500,
            speedIncrease: 0.0003,
            maxSpeed: 8
        },
        medium: {
            speed: 5,
            spawnInterval: 2000,
            speedIncrease: 0.0005,
            maxSpeed: 12
        },
        hard: {
            speed: 7,
            spawnInterval: 1500,
            speedIncrease: 0.0008,
            maxSpeed: 15
        }
    };
    
    // timing - using ms bc that's what javascript Date/setTimeout use
    static FRAME_RATE = 60;
    static GESTURE_CHANGE_INTERVAL_DEFAULT = 5000;
    
    // visuals
    static COLOR_GROUND = '#9ca3af';
    static COLOR_SKY = '#f3f4f6';
    static COLOR_SUCCESS = '#10b981';
    
    static getDifficultySettings(difficulty = 'medium') {
        return this.DIFFICULTY_PRESETS[difficulty] || this.DIFFICULTY_PRESETS.medium;
    }
}

