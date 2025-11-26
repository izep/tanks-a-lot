import { BaseProjectile } from './BaseProjectile.js';
import { Terrain } from '../terrain.js';

// Digger now tracks underground time/distance and signals when to explode.
export class DiggerProjectile extends BaseProjectile {
    private undergroundStarted: boolean = false;
    private undergroundTime: number = 0;
    private undergroundDistance: number = 0;
    private lastX: number;
    private lastY: number;
    public shouldExplode: boolean = false; // Checked by main loop

    // Thresholds (seconds & world units)
    private static readonly MAX_TUNNEL_TIME = 1.0;
    private static readonly MAX_TUNNEL_DISTANCE = 60;

    constructor(x: number, y: number, angle: number, power: number, type: string = 'digger', useContactTrigger: boolean = false) {
        super(x, y, angle, power, type, useContactTrigger);
        this.lastX = x;
        this.lastY = y;
    }

    update(dt: number, gravity: number, windSpeed: number, terrain?: Terrain): void {
        const prevX = this.x;
        const prevY = this.y;

        if (terrain && !this.useContactTrigger) {
            const terrainHeight = terrain.getHeight(this.x);
            const inTerrain = this.y <= terrainHeight;
            if (inTerrain) {
                if (!this.undergroundStarted) {
                    this.undergroundStarted = true;
                }
                // Continue through terrain at reduced velocity (damping simulates digging resistance)
                this.vx *= 0.98;
                this.vy *= 0.95;
                // Create small tunnel segment
                terrain.explode(this.x, this.y, 3);
                // Accumulate underground time
                this.undergroundTime += dt;
            }
        }

        super.update(dt, gravity, windSpeed, terrain);

        // After movement, if underground accumulate distance traveled this frame
        if (this.undergroundStarted && !this.shouldExplode) {
            const frameDist = Math.sqrt((this.x - prevX) ** 2 + (this.y - prevY) ** 2);
            this.undergroundDistance += frameDist;
            if (this.undergroundTime >= DiggerProjectile.MAX_TUNNEL_TIME || this.undergroundDistance >= DiggerProjectile.MAX_TUNNEL_DISTANCE) {
                this.shouldExplode = true;
            }
        }

        this.lastX = this.x;
        this.lastY = this.y;
    }
}
