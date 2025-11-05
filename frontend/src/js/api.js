class FluteVisionAPI {
    constructor(baseUrl = null) {
        if (baseUrl) {
            this.baseUrl = baseUrl;
        } else if (window.location.hostname.includes('herokuapp.com')) {
            // production - use the deployed API
            this.baseUrl = 'https://flutevision-api-2aeac29f3245.herokuapp.com/api/v1';
        } else {
            // local development
            this.baseUrl = `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
        }
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

    async predictFromImage(imageData) {
        const response = await fetch(`${this.baseUrl}/predict/base64`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        
        return await response.json();
    }

    async getAvailableGestures() {
        try {
            const response = await fetch(`${this.baseUrl}/fingerings`);
            return await response.json();
        } catch (error) {
            console.error('Failed to get gestures:', error);
            return { fingerings: [], count: 0 };
        }
    }
}
