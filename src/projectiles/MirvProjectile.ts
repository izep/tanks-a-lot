import { BaseProjectile } from './BaseProjectile.js';

export class MirvProjectile extends BaseProjectile {
    splitAtApogee: boolean;
    hasSplit: boolean;
    maxHeight: number;
    previousY: number;

    constructor(x: number, y: number, angle: number, power: number, type: string = 'mirv', useContactTrigger: boolean = false) {
        super(x, y, angle, power, type, useContactTrigger);
        this.splitAtApogee = true;
        this.hasSplit = false;
        this.maxHeight = y;
        this.previousY = y;
    }

    update(dt: number, gravity: number, windSpeed: number): void {
        this.previousY = this.y;
        super.update(dt, gravity, windSpeed);
        if (this.y > this.maxHeight) {
            this.maxHeight = this.y;
        }
    }

    shouldSplit(): boolean {
        if (!this.splitAtApogee || this.hasSplit) return false;
        // Split when starting to descend (vy becomes positive after being negative - Wait, y is Math Y, so vy is positive when going up, negative when going down.
        // Wait, standard physics: vy > 0 is UP. vy < 0 is DOWN.
        // In BaseProjectile.update:
        // this.vy -= gravity * dt; // Gravity reduces vy (makes it more negative)
        // this.y += this.vy * animationDt;

        // So vy starts positive (up), becomes 0 at apex, then negative (down).
        // Split at apogee: when vy crosses from positive to negative? Or just when vy < 0.

        // Previous code:
        // return this.vy > 0 && this.previousY > this.y;
        // If vy > 0, it's going UP. If previousY > y, it went DOWN? That's contradictory if using consistent steps.

        // Let's check BaseProjectile again.
        // this.vy -= gravity * dt;
        // this.y += this.vy * animationDt;

        // If gravity is positive (0.5), vy decreases.
        // Starts at say 10. Becomes 9.5... 0... -0.5...
        // y increases while vy > 0. y decreases when vy < 0.

        // So apogee is when vy goes from > 0 to < 0.
        // Or simply when vy < 0 and it hasn't split yet.

        // But we want it at the *peak*.
        return this.vy < 0 && !this.hasSplit;
    }
}
