// Theme configuration for different game environments
// Each theme has sky, ground, and obstacle colors

export const THEMES = {
    forest: {
        name: 'Mystic Forest',
        skyColor: '#4a148c', // deep purple
        groundColor: '#1b5e20', // dark green
        obstacleColor: '#7b1fa2', // purple
        playerColor: '#e91e63' // pink
    },
    garden: {
        name: 'Cozy Garden',
        skyColor: '#4fc3f7', // light blue
        groundColor: '#66bb6a', // green
        obstacleColor: '#1565c0', // dark blue
        playerColor: '#ffeb3b' // yellow
    },
    beach: {
        name: 'Sunset Beach',
        skyColor: '#ff6f00', // orange
        groundColor: '#d7ccc8', // sand
        obstacleColor: '#ffb74d', // light orange
        playerColor: '#263238' // dark blue-gray
    },
    peak: {
        name: 'Alpine Peak',
        skyColor: '#37474f', // dark gray
        groundColor: '#b0bec5', // light gray
        obstacleColor: '#546e7a', // medium gray
        playerColor: '#ffffff' // white
    },
    park: {
        name: 'Autumn Park',
        skyColor: '#8d6e63', // brown
        groundColor: '#d7ccc8', // light brown
        obstacleColor: '#a1887f', // medium brown
        playerColor: '#ffab00' // amber
    },
    night: {
        name: 'Starry Night',
        skyColor: '#0d47a1', // dark blue
        groundColor: '#1565c0', // medium blue
        obstacleColor: '#1976d2', // lighter blue
        playerColor: '#ffd54f' // yellow
    }
};

// Character emojis for player representation
export const CHARACTERS = {
    cat: '🐱',
    dog: '🐶',
    bear: '🐻',
    fox: '🦊',
    owl: '🦉',
    frog: '🐸'
};

export function getTheme(themeName) {
    return THEMES[themeName] || THEMES.forest;
}

export function getCharacter(characterName) {
    return CHARACTERS[characterName] || CHARACTERS.cat;
}

