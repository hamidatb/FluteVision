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

/**
 * VisionModeToggleUI - Handles switching between flute and hand prediction modes
 * Keeps UI in sync with the CameraController
 */
export class VisionModeToggleUI {
    constructor(cameraController) {
        this.cameraController = cameraController;
        this.toggleButton = null;
        this.iconElement = null;
    }

    initialize(buttonId = 'visionModeToggleBtn') {
        this.toggleButton = document.getElementById(buttonId);
        if (!this.toggleButton) return;
        this.iconElement = this.toggleButton.querySelector('.icon');

        // Initialize with current mode
        this.updateUI(this.cameraController.stream.predictionMode);

        // Add click listener
        this.toggleButton.addEventListener('click', () => this.handleToggle());
    }

    handleToggle() {
        this.cameraController.toggleVisionMode();
        const newMode = this.cameraController.stream.predictionMode;
        this.updateUI(newMode);
        
        // update gameSettings to keep everything in sync
        if (typeof window !== 'undefined' && window.gameSettings) {
            window.gameSettings.set('visionMode', newMode);
            console.log(`Updated gameSettings visionMode to: ${newMode}`);
            
            // trigger custom event so GameController can refresh gestures
            window.dispatchEvent(new CustomEvent('visionModeChanged', { detail: { mode: newMode } }));
        }
    }

    updateUI(mode) {
        if (!this.iconElement || !this.toggleButton) return;
        if (mode === 'flute') {
            this.iconElement.textContent = '🎵  FLUTE MODE';
        } else {
            this.iconElement.textContent = '🖐️ HAND MODE';
        }
    }
}

// Auto-initialize navigation on page load
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        const navController = new NavigationController();
        navController.initialize();
        
        window.navigationController = navController;
        
        // mobile nav toggle
        const navbarToggle = document.getElementById('navbar-toggle');
        if (navbarToggle) {
            navbarToggle.addEventListener('click', () => {
                const navLinks = document.querySelector(".nav-list");
                navLinks?.classList.toggle("open");
            });
        }
    });
}

