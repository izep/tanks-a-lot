import { GAME_CONFIG } from './constants.js';

// Game physics and environment
export class GameEnvironment {
    gravity: number;
    windSpeed: number;

    constructor() {
        this.gravity = GAME_CONFIG.GRAVITY;
        this.windSpeed = 0;
        this.generateWind();
    }

    generateWind(): void {
        // Random wind between WIND_MIN and WIND_MAX
        this.windSpeed = (Math.random() - 0.5) * GAME_CONFIG.WIND_RANGE;
    }

    setGravity(gravity: number): void {
        this.gravity = gravity;
    }
}
