import { BaseProjectile, getProjectileIntegrationStep } from './BaseProjectile.js';
import { Terrain } from '../terrain.js';
import { GAME_CONFIG } from '../constants.js';

export class RollerProjectile extends BaseProjectile {
    rollVelocity: number;
    previousY: number;
    rollPositions: Array<{x: number, time: number}>;
    lastPositionCheck: number;
    velocityDirectionChanges: number;
    lastVelocitySign: number;
    shouldExplode: boolean;
    rollStartTime: number;
    distanceTraveled: number;

    constructor(x: number, y: number, angle: number, power: number, type: string = 'roller', useContactTrigger: boolean = false) {
        super(x, y, angle, power, type, useContactTrigger);
        this.rollVelocity = 0;
        this.previousY = y;
        this.rollPositions = [];
        this.lastPositionCheck = 0;
        this.velocityDirectionChanges = 0;
        this.lastVelocitySign = 0;
        this.shouldExplode = false;
        this.rollStartTime = 0;
        this.distanceTraveled = 0;
    }

    update(dt: number, gravity: number, windSpeed: number, terrain?: Terrain): void {
        if (!terrain) {
            super.update(dt, gravity, windSpeed);
            return;
        }

        const terrainHeight = terrain.getHeight(this.x);
        const { steps, subDt } = getProjectileIntegrationStep(dt);
        if (steps === 0 || subDt === 0) {
            return;
        }
        const baseDt = GAME_CONFIG.DEFAULT_DELTA_TIME;
        // Check if we are on or below the ground (within small margin)
        // NOTE: this.y is height from bottom (Math Y). terrainHeight is also height from bottom.
        if (this.y <= terrainHeight + 5) {
             // Mark when rolling actually starts
             if (this.rollStartTime === 0) {
                this.rollStartTime = Date.now();

                // Initial kick to ensure it starts rolling downhill immediately
                const slopeRight = terrain.getHeight(this.x + 1) - terrain.getHeight(this.x);
                const slopeLeft = terrain.getHeight(this.x) - terrain.getHeight(this.x - 1);

                if (Math.abs(slopeRight) > Math.abs(slopeLeft)) {
                    // Steeper to the right - set initial positive velocity (right) if slope is negative (downhill)
                    // If slopeRight is negative (downhill), we want positive velocity.
                    // If slopeRight is positive (uphill), we don't want to force it unless momentum carries it?
                    // Actually, just set velocity in direction of descent.
                    if (slopeRight < 0) this.rollVelocity = 2; // Start rolling right
                } else {
                    // Steeper to the left
                    if (slopeLeft > 0) this.rollVelocity = -2; // Start rolling left (slopeLeft > 0 means downhill to left)
                }
            }

            // On ground, roll downhill
            // Calculate slope: positive means terrain goes up to the right (roll left), negative means down to the right (roll right)
            for (let i = 0; i < steps; i++) {
                const slopeRight = terrain.getHeight(this.x + 1) - terrain.getHeight(this.x);
                const slopeLeft = terrain.getHeight(this.x) - terrain.getHeight(this.x - 1);

                // Roll in direction of downhill gradient. Negative slope values indicate downhill to the right.
                const downhillRightMagnitude = Math.max(
                    slopeRight < 0 ? -slopeRight : 0,
                    slopeLeft  < 0 ? -slopeLeft  : 0
                );
                const downhillLeftMagnitude = Math.max(
                    slopeRight > 0 ? slopeRight : 0,
                    slopeLeft  > 0 ? slopeLeft  : 0
                );
                const acceleration = (downhillRightMagnitude - downhillLeftMagnitude) * 0.8;

                this.rollVelocity += acceleration * subDt;
                const frictionDecay = Math.pow(0.99, subDt / Math.max(baseDt, 1e-6));
                this.rollVelocity *= frictionDecay;

                // Prevent rolling uphill (allow small momentum over tiny bumps)
                const UPHILL_THRESHOLD = 6; // Increased threshold significantly (was 4)
                if (this.rollVelocity > 0 && slopeRight > UPHILL_THRESHOLD) {
                    this.rollVelocity = 0;
                } else if (this.rollVelocity < 0 && slopeLeft < -UPHILL_THRESHOLD) {
                    this.rollVelocity = 0;
                }

                const downhillLeft = slopeLeft > UPHILL_THRESHOLD;
                if (this.rollVelocity < 0 && slopeRight > UPHILL_THRESHOLD && !downhillLeft) {
                    this.rollVelocity = 0;
                }

                // Clamp velocity to prevent excessive speed
                this.rollVelocity = Math.max(-20, Math.min(20, this.rollVelocity)); // Increased max speed (was 15)

                // Track velocity direction changes (oscillation detection)
                const currentVelocitySign = this.rollVelocity > 0 ? 1 : (this.rollVelocity < 0 ? -1 : 0);
                if (this.lastVelocitySign !== 0 && currentVelocitySign !== 0 &&
                    this.lastVelocitySign !== currentVelocitySign) {
                    this.velocityDirectionChanges++;
                } else if (Math.abs(this.rollVelocity) < 0.1) {
                    // Reset counter if velocity is near zero
                    this.velocityDirectionChanges = Math.max(0, this.velocityDirectionChanges - 1);
                }
                this.lastVelocitySign = currentVelocitySign;

                this.x += this.rollVelocity * subDt;
                this.distanceTraveled += Math.abs(this.rollVelocity * subDt);
                this.y = terrain.getHeight(this.x) + 5;
                this.vx = 0;
                this.vy = 0;
            }

            // Track position for stuck detection using wall-clock time (for gameplay pacing)
            const currentTime = Date.now();
            if (currentTime - this.lastPositionCheck > 100) { // Check every 100ms
                this.rollPositions.push({x: this.x, time: currentTime});
                // Keep only last 10 positions (1 second of history)
                if (this.rollPositions.length > 10) {
                    this.rollPositions.shift();
                }
                this.lastPositionCheck = currentTime;
            }

            // Only check explosion conditions after roller has been rolling for at least 500ms
            const timeRolling = currentTime - this.rollStartTime;
            if (timeRolling > 500) {
                // Check if should explode (stuck, significant valley, or distance exceeded)
                this.shouldExplode = this.isStuck();

                if (!this.shouldExplode) {
                    // Check if in significant valley
                    const VALLEY_THRESHOLD = 8; // Increased threshold significantly (was 5)
                    const slopeRightCheck = terrain.getHeight(this.x + 1) - terrain.getHeight(this.x);
                    const slopeLeftCheck = terrain.getHeight(this.x) - terrain.getHeight(this.x - 1);

                    // Valley: Uphill to right (positive slope) AND Uphill to left (negative slopeLeft)
                    const isValley = slopeRightCheck > VALLEY_THRESHOLD && slopeLeftCheck < -VALLEY_THRESHOLD;

                    const MAX_DISTANCE = 2000; // Increased distance significantly (was 1200)
                    const distanceExceeded = this.distanceTraveled > MAX_DISTANCE;

                    this.shouldExplode = isValley || distanceExceeded;
                }
            } else {
                // Don't explode if just started rolling
                this.shouldExplode = false;
            }

            // Add trail even when rolling
             if (this.trail.length >= GAME_CONFIG.PROJECTILE_TRAIL_MAX_LENGTH) {
                this.trail.shift();
            }
            this.trail.push({x: this.x, y: this.y});

        } else {
            // Not on ground yet, fall normally
            super.update(dt, gravity, windSpeed, terrain);
        }
    }

    isStuck(): boolean {
        // Check 1: Velocity changing direction frequently (oscillating) - more aggressive
        if (this.velocityDirectionChanges >= 3) {
            return true;
        }

        // Check 2: Position-based stuck detection
        if (this.rollPositions.length >= 3) {
            const positions = this.rollPositions;
            const positionRange = Math.max(...positions.map(p => p.x)) - Math.min(...positions.map(p => p.x));
            const timeSpan = positions[positions.length - 1].time - positions[0].time;

            // Stuck if: small position range (< 25 pixels) over significant time (> 300ms) and low velocity
            if (positionRange < 25 && timeSpan > 300 && Math.abs(this.rollVelocity) < 2.0) {
                return true;
            }

            // Also check if very low velocity for extended period
            if (timeSpan > 500 && Math.abs(this.rollVelocity) < 0.3) {
                return true;
            }
        }

        return false;
    }
}
