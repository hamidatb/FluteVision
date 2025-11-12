import { Hands } from '@mediapipe/hands';

export class HandLandmarkVisualizer {
    constructor(videoElementId, canvasElementId) {
        this.videoElementId = videoElementId;
        this.canvasElementId = canvasElementId;
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.hands = null;
        this.isEnabled = false;
        this.frameId = null;
        this.isReady = false;
    }

    async initialize() {
        if (this.isReady) return true;

        this.video = document.getElementById(this.videoElementId);
        this.canvas = document.getElementById(this.canvasElementId);
        if (!this.video || !this.canvas) {
            console.error('missing video or canvas element');
            return false;
        }

        this.ctx = this.canvas.getContext('2d');

        this.hands = new Hands({
            locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
        });

        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults((r) => this.onResults(r));
        this.isReady = true;
        //console.log('🖐️ visualizer ready');
        return true;
    }

    onResults(results) {
        if (!this.isEnabled || !this.ctx) return;

        // resize canvas to match video
        if (
            this.canvas.width !== this.video.videoWidth ||
            this.canvas.height !== this.video.videoHeight
        ) {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
        }

        const ctx = this.ctx;
        ctx.save();
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const fingerColors = {
            thumb: '#00fff2',   
            index: '#ff0078',   
            middle: '#ffaa00',  
            ring: '#00ff88',   
            pinky: '#a000ff'    
        };

        const fingerIndices = {
            thumb: [1, 2, 3, 4],
            index: [5, 6, 7, 8],
            middle: [9, 10, 11, 12],
            ring: [13, 14, 15, 16],
            pinky: [17, 18, 19, 20]
        };

        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                // draw palm outline in soft white
                const palmConnections = [
                    [0, 1], [1, 5], [5, 9], [9, 13], [13, 17], [17, 0]
                ];
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#ffffff';
                ctx.shadowColor = 'rgba(255,255,255,0.3)';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                for (const [a, b] of palmConnections) {
                    ctx.moveTo(landmarks[a].x * this.canvas.width, landmarks[a].y * this.canvas.height);
                    ctx.lineTo(landmarks[b].x * this.canvas.width, landmarks[b].y * this.canvas.height);
                }
                ctx.stroke();

                // draw each finger
                for (const [finger, indices] of Object.entries(fingerIndices)) {
                    const color = fingerColors[finger];
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 4;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 18;

                    // finger lines
                    ctx.beginPath();
                    ctx.moveTo(
                        landmarks[indices[0]].x * this.canvas.width,
                        landmarks[indices[0]].y * this.canvas.height
                    );
                    indices.forEach((i) => {
                        ctx.lineTo(
                            landmarks[i].x * this.canvas.width,
                            landmarks[i].y * this.canvas.height
                        );
                    });
                    ctx.stroke();

                    // joints
                    indices.forEach((i, idx) => {
                        const lm = landmarks[i];
                        ctx.beginPath();
                        ctx.arc(
                            lm.x * this.canvas.width,
                            lm.y * this.canvas.height,
                            idx === indices.length - 1 ? 7 : 4, // bigger tip
                            0,
                            2 * Math.PI
                        );
                        ctx.fillStyle = color;
                        ctx.shadowColor = color;
                        ctx.shadowBlur = idx === indices.length - 1 ? 25 : 8;
                        ctx.fill();
                    });
                }
            }
        }

        ctx.restore();
    }

    async processFrame() {
        if (!this.isEnabled || !this.hands || !this.video) return;
        // this wont work on remote unless unsafe eval is enabled and im not enabling it
        // try {
        //     //await this.hands.send({ image: this.video });
            
        // } catch (e) {
        //     console.error('frame error', e);
        // }
        // //if (this.isEnabled) this.frameId = requestAnimationFrame(() => this.processFrame());
    }

    enable() {
        if (!this.isReady) {
            console.warn('not initialized yet');
            return false;
        }
        if (this.isEnabled) return true;
        this.isEnabled = true;
        this.processFrame();
        //console.log('✨ hand viz on');
        return true;
    }

    disable() {
        if (!this.isEnabled) return;
        this.isEnabled = false;
        if (this.frameId) cancelAnimationFrame(this.frameId);
        if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        //console.log('💤 hand viz off');
    }

    toggle() {
        return this.isEnabled ? (this.disable(), false) : this.enable();
    }

    cleanup() {
        this.disable();
        if (this.hands) this.hands.close();
        this.isReady = false;
        //console.log('Cleaned up');
    }
}
