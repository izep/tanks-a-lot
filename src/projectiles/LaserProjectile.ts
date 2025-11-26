import { BaseProjectile } from './BaseProjectile.js';

export class LaserProjectile extends BaseProjectile {
    constructor(x: number, y: number, angle: number, power: number, type: string = 'laser', useContactTrigger: boolean = false) {
        super(x, y, angle, power, type, useContactTrigger);
    }

    // Laser handles everything instantly in GameController, so update is empty or minimal
    update(dt: number, gravity: number, windSpeed: number): void {
        // No physics for laser
    }
}
