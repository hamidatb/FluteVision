/**
 * Centralized API configuration
 * Determines API URL based on environment
 */
export function getApiUrl() {
    if (window.location.hostname.includes('herokuapp.com')) {
        // prod
        return 'https://flutevision-api-2aeac29f3245.herokuapp.com/api/v1';
    } else {
        // local dev
        return 'http://localhost:8000/api/v1';
    }
}

