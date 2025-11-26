import { BaseProjectile } from './BaseProjectile.js';

export class FunkyProjectile extends BaseProjectile {
    bounces: number;
    maxBounces: number;

    constructor(x: number, y: number, angle: number, power: number, type: string = 'funky', useContactTrigger: boolean = false) {
        super(x, y, angle, power, type, useContactTrigger);
        this.bounces = 0;
        this.maxBounces = 3;
    }

    // Handle bounce
    bounce(terrainHeight: number): boolean {
        if (this.bounces >= this.maxBounces) return false;

        // Bounce with energy loss
        this.vy = Math.abs(this.vy) * 0.6; // Bounce up with 60% energy
        this.vx *= 0.8; // Reduce horizontal velocity
        this.bounces++;
        this.y = terrainHeight + 5; // Place slightly above terrain
        return true;
    }
}
