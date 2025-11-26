import { describe, it, expect, beforeEach } from 'vitest';
import { Terrain } from '../src/terrain';

describe('Terrain', () => {
    let terrain: Terrain;
    const width = 200;
    const maxHeight = 150;

    beforeEach(() => {
        terrain = new Terrain(width, maxHeight);
    });

    it('returns zero height for out-of-bounds queries', () => {
        expect(terrain.getHeight(-10)).toBe(0);
        expect(terrain.getHeight(width + 10)).toBe(0);
    });

    it('creates craters when exploding', () => {
        const internal = terrain as unknown as { heights: number[] };
        internal.heights = new Array(width).fill(80);

        const before = terrain.getHeight(100);
        terrain.explode(100, 80, 20);
        const after = terrain.getHeight(100);

        expect(after).toBeLessThan(before);
    });

    it('adds dirt without exceeding maximum height', () => {
        const internal = terrain as unknown as { heights: number[] };
        internal.heights = new Array(width).fill(10);

        terrain.addDirt(50, 10, 30);

        const height = terrain.getHeight(50);
        expect(height).toBeGreaterThan(10);
        expect(height).toBeLessThanOrEqual(maxHeight);
    });

    it('returns surface Y coordinate relative to canvas height', () => {
        const canvasHeight = 400;
        const height = terrain.getHeight(20);
        expect(terrain.getSurfaceY(20, canvasHeight)).toBe(canvasHeight - height);
    });
});
