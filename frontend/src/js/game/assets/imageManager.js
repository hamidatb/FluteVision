// handles loading and caching of images
// using promise-based loading bc images load async and we need to wait for them
export class ImageManager {
    constructor() {
        this.images = new Map();
        this.loadingPromises = new Map();
    }
    
    async loadImage(key, url) {
        // if already loaded, return cached version
        if (this.images.has(key)) {
            return this.images.get(key);
        }
        
        // if currently loading, return existing promise to avoid duplicate requests
        if (this.loadingPromises.has(key)) {
            return this.loadingPromises.get(key);
        }
        
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                this.images.set(key, img);
                this.loadingPromises.delete(key);
                resolve(img);
            };
            
            img.onerror = () => {
                this.loadingPromises.delete(key);
                reject(new Error(`Failed to load image: ${url}`));
            };
            
            img.src = url;
        });
        
        this.loadingPromises.set(key, promise);
        return promise;
    }
    
    getImage(key) {
        return this.images.get(key);
    }
    
    hasImage(key) {
        return this.images.has(key);
    }
    
    // preload multiple images in parallel
    async preloadImages(imageMap) {
        const promises = Object.entries(imageMap).map(([key, url]) => 
            this.loadImage(key, url)
        );
        return Promise.all(promises);
    }
    
    clear() {
        this.images.clear();
        this.loadingPromises.clear();
    }
}

// singleton
export const imageManager = new ImageManager();

