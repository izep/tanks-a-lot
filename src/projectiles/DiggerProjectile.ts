import { BaseProjectile } from './BaseProjectile.js';
import { Terrain } from '../terrain.js';

export class DiggerProjectile extends BaseProjectile {
    constructor(x: number, y: number, angle: number, power: number, type: string = 'digger', useContactTrigger: boolean = false) {
        super(x, y, angle, power, type, useContactTrigger);
    }

    update(dt: number, gravity: number, windSpeed: number, terrain?: Terrain): void {
        if (terrain && !this.useContactTrigger) {
            const terrainHeight = terrain.getHeight(this.x);
            if (this.y <= terrainHeight) {
                // Continue through terrain at reduced velocity
                this.vx *= 0.98;
                this.vy *= 0.95;
                // Create tunnel
                terrain.explode(this.x, this.y, 3);
            }
        }
        super.update(dt, gravity, windSpeed, terrain);
    }
}
