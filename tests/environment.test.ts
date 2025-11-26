import { describe, it, expect } from 'vitest';
import { GameEnvironment } from '../src/environment';
import { GAME_CONFIG } from '../src/constants';

describe('GameEnvironment', () => {
    it('keeps gravity configurable', () => {
        const env = new GameEnvironment();
        env.setGravity(1.25);
        expect(env.gravity).toBe(1.25);
    });

    it('generates wind inside the configured range', () => {
        const env = new GameEnvironment();

        for (let i = 0; i < 10; i++) {
            env.generateWind();
            expect(env.windSpeed).toBeGreaterThanOrEqual(GAME_CONFIG.WIND_MIN);
            expect(env.windSpeed).toBeLessThanOrEqual(GAME_CONFIG.WIND_MAX);
        }
    });
});
