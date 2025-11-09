import { getApiUrl } from './apiConfig.js';

export class FluteVisionAPI {
    constructor(baseUrl = null) {
        this.baseUrl = baseUrl || getApiUrl();
    }

    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'error', error: error.message };
        }
    }

    async getAvailableGestures(mode = 'flute') {
        try {
            const response = await fetch(`${this.baseUrl}/fingerings?mode=${mode}`);
            return await response.json();
        } catch (error) {
            console.error('Failed to get gestures:', error);
            return { fingerings: [], count: 0 };
        }
    }
}
