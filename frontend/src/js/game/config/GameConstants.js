// immutable game constants - things that define core mechanics and shouldn't change during gameplay
export class GameConstants {
    // canvas
    static CANVAS_WIDTH = 800;
    static CANVAS_HEIGHT = 380;
    
    // player physics, not that I'm the best at that. idk
    static PLAYER_WIDTH = 80;
    static PLAYER_HEIGHT = 120;
    static PLAYER_X = 350; // fixed x position bc it's a runner game - moved to middle-left
    static PLAYER_GROUND_Y = 320; // floor position - lower on canvas
    static JUMP_VELOCITY = -18; // negative y increases downward, increase just means a faster jump
    static GRAVITY = 0.9; // less = more float
    
    // obstacle generation
    static OBSTACLE_MIN_WIDTH = 30;
    static OBSTACLE_MAX_WIDTH = 50;
    static OBSTACLE_MIN_HEIGHT = 45;
    static OBSTACLE_MAX_HEIGHT = 110;
    
    // difficulty presets - these are only relevant on random mode, but right now I dont actually let users pick difficulty.
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

