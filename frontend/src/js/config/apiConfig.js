/**
 * Centralized API configuration
 * Determines API URL based on environment
 */
export function getApiUrl() {
    if (window.location.hostname.includes('herokuapp.com')) {
        // Production - use the deployed API
        return 'https://flutevision-api-2aeac29f3245.herokuapp.com/api/v1';
    } else {
        // Local development
        return 'http://localhost:8000/api/v1';
    }
}

