import { BaseProjectile } from './BaseProjectile.js';

export class NapalmProjectile extends BaseProjectile {
    explodeBeforeHit: boolean;

    constructor(x: number, y: number, angle: number, power: number, type: string = 'napalm', useContactTrigger: boolean = false) {
        super(x, y, angle, power, type, useContactTrigger);
        this.explodeBeforeHit = true;
    }
}
