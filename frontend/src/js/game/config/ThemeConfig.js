export const DEFAULT_THEME = 'uofa';
const char_path = `images/chars/`
const theme_path = `images/themes/`

// note: All images, chars, and backgrounds were generated using Canva AI

export const THEMES = {
    uofa: {
        name: 'UofA',
        backgroundImage: theme_path + 'uofa/background.jpg',
        groundImage: theme_path + 'uofa/ground.png',
        obstacleImage: theme_path + 'uofa/obstacle.png'
    },
    louvre: {
        name: 'The Louvre',
        backgroundImage: theme_path + 'louvre/background.jpg',
        groundImage: theme_path + 'louvre/ground.png',
        obstacleImage: theme_path + 'louvre/obstacle.png'
    },
    forest: {
        name: 'Forest',
        backgroundImage: theme_path + 'forest/background.jpg',
        groundImage: theme_path + 'forest/ground.png',
        obstacleImage: theme_path + 'forest/obstacle.png'
    }
};

export const CHARACTERS = {
  Hami: char_path + 'hami.png',
  Hami_jump: char_path + 'hami_jump.png',
  Guba: char_path + 'guba.png',
  Guba_jump: char_path + 'guba_jump.png',
  Killua: char_path + 'killua.png',
  Killua_jump: char_path + 'killua_jump.png',
};

export function getTheme(themeName) {
    return THEMES[themeName] || THEMES[DEFAULT_THEME];
}

// Get the default theme object
export function getDefaultTheme() {
    return THEMES[DEFAULT_THEME];
}

// Get the default theme name
export function getDefaultThemeName() {
    return DEFAULT_THEME;
}
