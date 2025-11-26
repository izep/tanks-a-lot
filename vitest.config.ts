import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['src/**/*.ts'],
            exclude: ['src/main.ts', 'src/projectiles/index.ts', 'src/tank.ts', 'src/effects.ts'],
            thresholds: {
                statements: 0.8,
                branches: 0.7,
                functions: 0.75,
                lines: 0.8
            }
        }
    }
});
