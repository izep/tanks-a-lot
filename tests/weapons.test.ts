import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectileFactory } from '../src/projectiles/ProjectileFactory';
import { RollerProjectile } from '../src/projectiles/RollerProjectile';
import { MirvProjectile } from '../src/projectiles/MirvProjectile';
import { FunkyProjectile } from '../src/projectiles/FunkyProjectile';
import { Terrain } from '../src/terrain';

describe('ProjectileFactory', () => {
    it('creates correct projectile types', () => {
        const normal = ProjectileFactory.create(0, 0, 45, 50, 'normal');
        expect(normal.type).toBe('normal');

        const roller = ProjectileFactory.create(0, 0, 45, 50, 'roller');
        expect(roller).toBeInstanceOf(RollerProjectile);
        expect(roller.type).toBe('roller');

        const mirv = ProjectileFactory.create(0, 0, 45, 50, 'mirv');
        expect(mirv).toBeInstanceOf(MirvProjectile);

        const funky = ProjectileFactory.create(0, 0, 45, 50, 'funky');
        expect(funky).toBeInstanceOf(FunkyProjectile);
    });
});

describe('RollerProjectile', () => {
    let terrain: any;

    beforeEach(() => {
        terrain = new Terrain(1000, 600);
    });

    it('initializes correctly', () => {
        const roller = new RollerProjectile(100, 100, 45, 50, 'roller');
        expect(roller.rollVelocity).toBe(0);
    });

    it('rolls downhill', () => {
        const roller = new RollerProjectile(100, 105, 0, 0, 'roller');

        // Mock terrain to slope down to the right
        terrain.getHeight = vi.fn((x) => {
            if (Math.abs(x - 100) < 0.1) return 100;
            if (x > 100) return 90; // Downhill to right
            return 100;
        });

        // Update
        roller.update(0.1, 0.5, 0, terrain);

        // Should have positive roll velocity (right)
        expect(roller.rollVelocity).toBeGreaterThan(0);
        expect(roller.x).toBeGreaterThan(100);
    });

    it('stops on uphill', () => {
        const roller = new RollerProjectile(100, 105, 0, 0, 'roller');
        roller.rollVelocity = 5; // Moving right

        // Mock terrain to slope UP to the right steeply
        terrain.getHeight = vi.fn((x) => {
            if (Math.abs(x - 100) < 0.1) return 100;
            if (x > 100) return 110; // Steep uphill
            return 100;
        });

        roller.update(0.1, 0.5, 0, terrain);

        // Should stop
        expect(roller.rollVelocity).toBe(0);
    });
});

describe('MirvProjectile', () => {
    it('should split at apogee', () => {
        const mirv = new MirvProjectile(100, 100, 90, 50, 'mirv');
        mirv.vy = 10; // Going up (positive Math Y)
        mirv.update(0.1, 10, 0); // Gravity slows it down

        expect(mirv.shouldSplit()).toBe(false);

        mirv.vy = -1; // Going down
        expect(mirv.shouldSplit()).toBe(true);
    });
});
