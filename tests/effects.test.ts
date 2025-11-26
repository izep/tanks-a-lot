import { describe, it, expect } from 'vitest';
import { Explosion, NapalmPool } from '../src/effects';
import { Terrain } from '../src/terrain';

describe('Explosion', () => {
    it('expires after its lifetime elapses', () => {
        const explosion = new Explosion(0, 0, 'normal');
        expect(explosion.update(0.1)).toBe(true);
        expect(explosion.update(10)).toBe(false);
    });
});

describe('NapalmPool', () => {
    it('expands and deals damage within radius', () => {
        const terrain = new Terrain(100, 60);
        const pool = new NapalmPool(0, 0, 20);

        pool.update(1, terrain);
        expect(pool.radius).toBeGreaterThan(0);

        const innerDamage = pool.checkDamage(0, 0);
        const outerDamage = pool.checkDamage(100, 0);

        expect(innerDamage).toBeGreaterThan(0);
        expect(outerDamage).toBe(0);
    });
});
