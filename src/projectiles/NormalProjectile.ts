import { BaseProjectile } from './BaseProjectile.js';

export class NormalProjectile extends BaseProjectile {
    constructor(x: number, y: number, angle: number, power: number, type: string = 'normal', useContactTrigger: boolean = false) {
        super(x, y, angle, power, type, useContactTrigger);
    }
}
