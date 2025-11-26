import { BaseProjectile } from '../projectiles/BaseProjectile.js';
import { Tank } from '../tank.js';

export interface Point {
    x: number;
    y: number;
}

/**
 * Returns the earliest known position of a projectile, falling back to the
 * projectile's current coordinates if no trail samples are available yet.
 */
export function getProjectileOrigin(projectile: BaseProjectile): Point {
    const firstSample = projectile.trail[0];
    if (firstSample && Number.isFinite(firstSample.x) && Number.isFinite(firstSample.y)) {
        return { x: firstSample.x, y: firstSample.y };
    }
    return { x: projectile.x, y: projectile.y };
}

/**
 * Finds the closest alive tank to the supplied point.
 */
export function findClosestTankToPoint(tanks: Tank[], point: Point): Tank | null {
    let closestTank: Tank | null = null;
    let minDistance = Infinity;

    for (const tank of tanks) {
        if (!tank || !tank.isAlive()) {
            continue;
        }
        const dx = tank.x - point.x;
        const dy = tank.y - point.y;
        const distance = Math.hypot(dx, dy);

        if (distance < minDistance) {
            minDistance = distance;
            closestTank = tank;
        }
    }

    return closestTank;
}
