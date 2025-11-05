// single source of truth for all game constants - DRY principle
class GameConfig {
    // canvas dimensions
    static CANVAS_WIDTH = 800;
    static CANVAS_HEIGHT = 300;
    
    // player properties
    static PLAYER_WIDTH = 40;
    static PLAYER_HEIGHT = 60;
    static PLAYER_X = 100;
    static PLAYER_GROUND_Y = 200;
    static JUMP_VELOCITY = -12;
    static GRAVITY = 0.6;
    
    // obstacle properties
    static OBSTACLE_MIN_WIDTH = 20;
    static OBSTACLE_MAX_WIDTH = 40;
    static OBSTACLE_MIN_HEIGHT = 30;
    static OBSTACLE_MAX_HEIGHT = 80;
    static OBSTACLE_SPEED = 5;
    static OBSTACLE_SPAWN_INTERVAL = 2000; // ms
    
    // game mechanics
    static JUMP_CONFIDENCE_THRESHOLD = 0.7; // need 70% confidence to jump
    static GESTURE_CHANGE_INTERVAL = 5000; // change target gesture every 5s
    
    // difficulty scaling
    static SPEED_INCREASE_RATE = 0.0005; // gradual speed increase
    static MAX_SPEED = 12;
    
    // colors (nice modern palette)
    static COLOR_PLAYER = '#667eea';
    static COLOR_OBSTACLE = '#ef4444';
    static COLOR_GROUND = '#9ca3af';
    static COLOR_SKY = '#f3f4f6';
    static COLOR_SUCCESS = '#10b981';
}

