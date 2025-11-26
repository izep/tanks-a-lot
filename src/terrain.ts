import { GAME_CONFIG } from './constants.js';

// Terrain generation and manipulation
export class Terrain {
    private heights: number[];
    private width: number;
    private maxHeight: number;

    constructor(width: number, maxHeight: number) {
        this.width = width;
        this.maxHeight = maxHeight;
        this.heights = new Array(width).fill(0);
        this.generate();
    }

    private generate(): void {
        // Generate random terrain using midpoint displacement
        const segments = GAME_CONFIG.TERRAIN_SEGMENTS;
        const segmentWidth = this.width / segments;

        // Set random heights at segment boundaries
        for (let i = 0; i <= segments; i++) {
            const x = Math.floor(i * segmentWidth);
            this.heights[x] = Math.random() * this.maxHeight * GAME_CONFIG.TERRAIN_HEIGHT_MAX_RATIO
                + this.maxHeight * GAME_CONFIG.TERRAIN_HEIGHT_MIN_RATIO;
        }

        // Interpolate between points
        for (let i = 0; i < segments; i++) {
            const x1 = Math.floor(i * segmentWidth);
            const x2 = Math.floor((i + 1) * segmentWidth);
            const h1 = this.heights[x1];
            const h2 = this.heights[x2];

            for (let x = x1; x < x2; x++) {
                const t = (x - x1) / (x2 - x1);

                // Cosine interpolation for smoother, less angular hills
                const ft = t * Math.PI;
                const f = (1 - Math.cos(ft)) * 0.5;

                // Add some randomness
                const noise = (Math.random() - 0.5) * GAME_CONFIG.TERRAIN_NOISE_AMPLITUDE;
                this.heights[x] = h1 * (1 - f) + h2 * f + noise;
            }
        }

        // Smooth the terrain multiple times to remove tiny spikes while keeping shape
        for (let i = 0; i < 5; i++) {
            this.smooth();
        }
    }

    private smooth(): void {
        const smoothed = [...this.heights];
        for (let i = 1; i < this.width - 1; i++) {
            smoothed[i] = (this.heights[i - 1] + this.heights[i] + this.heights[i + 1]) / 3;
        }
        this.heights = smoothed;
    }

    getHeight(x: number): number {
        if (!Number.isFinite(x)) {
            console.warn('Invalid x coordinate for terrain height:', x);
            return 0;
        }
        const ix = Math.floor(x);
        if (ix < 0 || ix >= this.width) {
            return 0;
        }
        return this.heights[ix] ?? 0;
    }

    // Explosion creates a crater and makes terrain settle like viscous sand
    explode(x: number, y: number, radius: number): void {
        const ix = Math.floor(x);

        // Create crater
        for (let i = Math.max(0, ix - radius); i < Math.min(this.width, ix + radius); i++) {
            const dist = Math.abs(i - ix);
            const effect = Math.max(0, 1 - dist / radius);
            const craterDepth = radius * effect * 0.8;

            if (this.heights[i] > y - radius) {
                this.heights[i] -= craterDepth;
            }
        }

        // Settle terrain like viscous sand (no overhangs)
        this.settle();
    }

    // Make terrain settle to remove overhangs
    private settle(): void {
        const maxSlope = GAME_CONFIG.TERRAIN_MAX_SLOPE;
        const maxIterations = GAME_CONFIG.TERRAIN_SETTLE_ITERATIONS;

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            let settled = true;
            for (let i = 0; i < this.width - 1; i++) {
                const diff = this.heights[i] - this.heights[i + 1];
                if (Math.abs(diff) > maxSlope) {
                    const transfer = (Math.abs(diff) - maxSlope) / 2;
                    if (diff > 0) {
                        this.heights[i] -= transfer;
                        this.heights[i + 1] += transfer;
                    } else {
                        this.heights[i] += transfer;
                        this.heights[i + 1] -= transfer;
                    }
                    settled = false;
                }
            }
            if (settled) break;
        }
    }

    render(ctx: CanvasRenderingContext2D, canvasHeight: number): void {
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(0, canvasHeight);

        for (let x = 0; x < this.width; x++) {
            ctx.lineTo(x, canvasHeight - this.heights[x]);
        }

        ctx.lineTo(this.width, canvasHeight);
        ctx.closePath();
        ctx.fill();

        // Draw grass on top
        ctx.strokeStyle = '#228B22';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = 0; x < this.width; x++) {
            if (x === 0) {
                ctx.moveTo(x, canvasHeight - this.heights[x]);
            } else {
                ctx.lineTo(x, canvasHeight - this.heights[x]);
            }
        }
        ctx.stroke();
    }

    getWidth(): number {
        return this.width;
    }

    // Add dirt to terrain (for dirt clods/balls)
    addDirt(x: number, y: number, radius: number): void {
        const ix = Math.floor(x);

        for (let i = Math.max(0, ix - radius); i < Math.min(this.width, ix + radius); i++) {
            const dist = Math.abs(i - ix);
            if (dist < radius) {
                const effect = 1 - (dist / radius);
                const dirtHeight = radius * effect * 0.5;
                const currentHeight = this.heights[i];
                // Add dirt, but don't exceed maxHeight
                this.heights[i] = Math.min(this.maxHeight, currentHeight + dirtHeight);
            }
        }

        // Settle terrain after adding dirt
        this.settle();
    }

    // Get the Y coordinate of the surface (distance from top of canvas)
    getSurfaceY(x: number, canvasHeight: number): number {
        return canvasHeight - this.getHeight(x);
    }
}
