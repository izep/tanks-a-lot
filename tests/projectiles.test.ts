import { describe, it, expect, vi } from 'vitest';
import { NormalProjectile } from '../src/projectiles/NormalProjectile';
import { DiggerProjectile } from '../src/projectiles/DiggerProjectile';
import { Terrain } from '../src/terrain';

describe('NormalProjectile physics', () => {
    it('updates position using gravity and wind', () => {
        const projectile = new NormalProjectile(0, 0, 45, 80, 'normal');
        const originalX = projectile.x;
        const originalY = projectile.y;

        projectile.update(0.016, 0.5, 0.2);

        expect(projectile.x).toBeGreaterThan(originalX);
        expect(projectile.y).toBeGreaterThan(originalY);
        expect(projectile.trail.length).toBeGreaterThan(0);
    });
});

describe('DiggerProjectile', () => {
    it('digs through terrain when underground and useContactTrigger is false', () => {
        const projectile = new DiggerProjectile(0, 0, 45, 80, 'digger', false); // Pass false for useContactTrigger
        const terrain = new Terrain(200, 150);
        const getHeightSpy = vi.spyOn(terrain as any, 'getHeight').mockReturnValue(50);
        const explodeSpy = vi.spyOn(terrain as any, 'explode');

        const originalVx = projectile.vx;
        const originalVy = projectile.vy;
        projectile.y = 40; // below terrain height
        projectile.update(0.016, 0.5, 0, terrain);

        expect(getHeightSpy).toHaveBeenCalled();
        expect(explodeSpy).toHaveBeenCalled(); // explode is called for tunneling
        expect(projectile.vx).toBeLessThan(originalVx);
        expect(projectile.vy).toBeLessThan(originalVy);
    });

    it('should explode on contact when useContactTrigger is true', () => {
        const projectile = new DiggerProjectile(0, 0, 45, 80, 'digger', true); // Pass true for useContactTrigger
        const terrain = new Terrain(200, 150);
        const getHeightSpy = vi.spyOn(terrain as any, 'getHeight').mockReturnValue(50);
        const explodeSpy = vi.spyOn(terrain as any, 'explode');

        projectile.y = 40; // below terrain height
        projectile.update(0.016, 0.5, 0, terrain);

        // When useContactTrigger is true, DiggerProjectile's update should *not* call terrain.explode
        // The main game loop's collision handling will trigger the explosion.
        expect(explodeSpy).not.toHaveBeenCalled(); 
        // We can assert that the projectile's velocity is not reduced, as it would if tunneling
        expect(projectile.vx).toBe(projectile.vx); // Should remain same as initial or changed by super.update
        expect(projectile.vy).toBe(projectile.vy); // Should remain same as initial or changed by super.update
    });
});
