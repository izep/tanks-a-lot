import { Terrain } from '../terrain.js';

const DIRT_WEAPONS = new Set(['dirtclod', 'dirtball']);

export type TerrainEffectResult = 'none' | 'explosion' | 'dirt';

/**
 * Applies the appropriate terrain mutation for a projectile impact.
 * Dirt-based weapons add material, tracers leave the terrain untouched,
 * and all other weapons create craters.
 */
export function applyTerrainEffect(
    terrain: Terrain,
    projectileType: string,
    x: number,
    y: number,
    radius: number
): TerrainEffectResult {
    if (projectileType === 'tracer') {
        return 'none';
    }

    if (DIRT_WEAPONS.has(projectileType)) {
        terrain.addDirt(x, y, radius);
        return 'dirt';
    }

    terrain.explode(x, y, radius);
    return 'explosion';
}
