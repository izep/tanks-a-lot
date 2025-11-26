import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyTerrainEffect } from '../src/gameLogic/terrainEffects';
import { getProjectileOrigin, findClosestTankToPoint } from '../src/gameLogic/projectileUtils';
import { Terrain } from '../src/terrain';
import { NormalProjectile } from '../src/projectiles/NormalProjectile';
import { Tank } from '../src/tank';

describe('Terrain effects helper', () => {
    let terrain: Terrain;

    beforeEach(() => {
        terrain = new Terrain(200, 120);
    });

    it('adds dirt for dirt weapons', () => {
        const addSpy = vi.spyOn(terrain as any, 'addDirt');
        const explodeSpy = vi.spyOn(terrain as any, 'explode');

        const result = applyTerrainEffect(terrain, 'dirtclod', 50, 40, 20);

        expect(result).toBe('dirt');
        expect(addSpy).toHaveBeenCalled();
        expect(explodeSpy).not.toHaveBeenCalled();
    });

    it('creates craters for normal weapons and ignores tracers', () => {
        const explodeSpy = vi.spyOn(terrain as any, 'explode');
        const addSpy = vi.spyOn(terrain as any, 'addDirt');

        const craterResult = applyTerrainEffect(terrain, 'normal', 60, 60, 30);
        expect(craterResult).toBe('explosion');
        expect(explodeSpy).toHaveBeenCalled();

        explodeSpy.mockClear();
        const tracerResult = applyTerrainEffect(terrain, 'tracer', 60, 60, 30);
        expect(tracerResult).toBe('none');
        expect(addSpy).not.toHaveBeenCalled();
        expect(explodeSpy).not.toHaveBeenCalled();
    });
});

describe('Projectile helpers', () => {
    it('falls back to projectile coordinates when no trail exists', () => {
        const projectile = new NormalProjectile(100, 120, 45, 50, 'normal');
        projectile.trail = [];

        const origin = getProjectileOrigin(projectile);
        expect(origin).toEqual({ x: 100, y: 120 });
    });

    it('prefers first trail sample when available', () => {
        const projectile = new NormalProjectile(0, 0, 45, 50, 'normal');
        projectile.trail = [{ x: 25, y: 35 }];

        const origin = getProjectileOrigin(projectile);
        expect(origin).toEqual({ x: 25, y: 35 });
    });

    it('finds the closest alive tank to a point', () => {
        const tank1 = new Tank(0, 0, '#f00');
        const tank2 = new Tank(100, 0, '#0f0');
        const tank3 = new Tank(50, 50, '#00f');
        tank2.takeDamage(200); // dead tank should be ignored

        const closest = findClosestTankToPoint([tank1, tank2, tank3], { x: 40, y: 40 });
        expect(closest).toBe(tank3);
    });
});
