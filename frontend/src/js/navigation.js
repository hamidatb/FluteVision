/**
 * NavigationController - Handles mobile navigation dropdown
 * Follows Single Responsibility Principle
 */
export class NavigationController {
    constructor() {
        this.navToggle = null;
        this.navLinks = null;
        this.isInitialized = false;
    }

    initialize() {
        if (this.isInitialized) return;

        this.navToggle = document.getElementById('navToggle');
        this.navLinks = document.querySelector('.nav-links');

        if (this.navToggle && this.navLinks) {
            this.navToggle.addEventListener('click', () => this.toggleNav());
            
            // Close nav when clicking on a link
            const links = this.navLinks.querySelectorAll('a');
            links.forEach(link => {
                link.addEventListener('click', () => this.closeNav());
            });

            // Close nav when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('header')) {
                    this.closeNav();
                }
            });

            this.isInitialized = true;
        }
    }

    toggleNav() {
        if (this.navLinks && this.navToggle) {
            this.navLinks.classList.toggle('show');
            this.navToggle.classList.toggle('active');
        }
    }

    closeNav() {
        if (this.navLinks && this.navToggle) {
            this.navLinks.classList.remove('show');
            this.navToggle.classList.remove('active');
        }
    }

    openNav() {
        if (this.navLinks && this.navToggle) {
            this.navLinks.classList.add('show');
            this.navToggle.classList.add('active');
        }
    }
}

/**
 * CameraToggleUI - Handles camera toggle button UI
 * Follows Single Responsibility Principle - only manages UI
 */
export class CameraToggleUI {
    constructor(cameraController) {
        this.cameraController = cameraController;
        this.toggleButton = null;
        this.statusIcon = null;
        this.statusText = null;
    }

    initialize(buttonId = 'cameraToggleBtn') {
        this.toggleButton = document.getElementById(buttonId);
        
        if (this.toggleButton) {
            this.statusIcon = this.toggleButton.querySelector('.camera-status-icon');
            this.statusText = this.toggleButton.querySelector('.camera-status-text');
            
            this.toggleButton.addEventListener('click', () => this.handleToggle());
            
            // Subscribe to camera state changes
            this.cameraController.onStateChange((state, isEnabled) => {
                this.updateUI(isEnabled);
            });
            
            // Set initial state
            this.updateUI(this.cameraController.isEnabled());
        }
    }

    async handleToggle() {
        this.toggleButton.disabled = true;
        const isNowOn = await this.cameraController.toggle();
        this.updateUI(isNowOn);
        this.toggleButton.disabled = false;
    }

    updateUI(isEnabled) {
        if (!this.toggleButton) return;

        if (isEnabled) {
            this.toggleButton.classList.remove('camera-off');
            this.toggleButton.title = 'Camera On - Click to turn off';
            if (this.statusIcon) this.statusIcon.textContent = '📹';
            if (this.statusText) this.statusText.textContent = 'Camera On';
        } else {
            this.toggleButton.classList.add('camera-off');
            this.toggleButton.title = 'Camera Off - Click to turn on';
            if (this.statusIcon) this.statusIcon.textContent = '🚫';
            if (this.statusText) this.statusText.textContent = 'Camera Off';
        }
    }
}

// Auto-initialize navigation on page load
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        const navController = new NavigationController();
        navController.initialize();
        
        // Make it globally accessible if needed
        window.navigationController = navController;
    });
}

