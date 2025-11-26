import { BaseProjectile } from './BaseProjectile.js';

export class ProjectileFactory {
    static create(x: number, y: number, angle: number, power: number, type: string, useContactTrigger: boolean = false): BaseProjectile {
        switch (type) {
            case 'roller':
            case 'babyroller':
                return new RollerProjectile(x, y, angle, power, type, useContactTrigger);
            case 'digger':
            case 'babydigger':
                return new DiggerProjectile(x, y, angle, power, type, useContactTrigger);
            case 'funky':
                return new FunkyProjectile(x, y, angle, power, type, useContactTrigger);
            case 'mirv':
                return new MirvProjectile(x, y, angle, power, type, useContactTrigger);
            case 'napalm':
                return new NapalmProjectile(x, y, angle, power, type, useContactTrigger);
            case 'laser':
                return new LaserProjectile(x, y, angle, power, type, useContactTrigger);
            default:
                return new NormalProjectile(x, y, angle, power, type, useContactTrigger);
        }
    }
}

import { NormalProjectile } from './NormalProjectile.js';
import { RollerProjectile } from './RollerProjectile.js';
import { DiggerProjectile } from './DiggerProjectile.js';
import { FunkyProjectile } from './FunkyProjectile.js';
import { MirvProjectile } from './MirvProjectile.js';
import { NapalmProjectile } from './NapalmProjectile.js';
import { LaserProjectile } from './LaserProjectile.js';
