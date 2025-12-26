import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEnvironment } from '../src/environment';
import { Tank } from '../src/tank';
import { Terrain } from '../src/terrain';
import { GAME_CONFIG } from '../src/constants';
import { AIDecisionContext, AI_PROFILE_OPTIONS, AIProfileId, getAIProfile } from '../src/ai/profiles';
import { getProjectileIntegrationStep } from '../src/projectiles/BaseProjectile';

const flatTerrain = {
    getHeight: () => 50,
    getWidth: () => 1200
} as unknown as Terrain;

function createEnvironment(): GameEnvironment {
    const environment = new GameEnvironment();
    environment.setGravity(GAME_CONFIG.GRAVITY);
    environment.windSpeed = 0;
    return environment;
}

function createContext(shooterName = 'AI'): AIDecisionContext {
    const shooter = new Tank(100, 120, '#0f0', shooterName, true);
    const targetA = new Tank(600, 150, '#f00', 'TargetA', false);
    const targetB = new Tank(800, 150, '#00f', 'TargetB', false);

    const playerMoneyByName: Record<string, number> = {
        [shooter.name]: 1000,
        [targetA.name]: 1000,
        [targetB.name]: 1000
    };

    return {
        shooter,
        enemies: [targetA, targetB],
        defaultTarget: targetA,
        environment: createEnvironment(),
        terrain: flatTerrain,
        history: { recentDamage: [] },
        playerMoneyByName
    };
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('AI profiles', () => {
    it('exposes all configured profiles', () => {
        const ids = AI_PROFILE_OPTIONS.map(option => option.id);
        expect(ids).toEqual(['moron', 'shooter', 'tosser', 'spoiler', 'cyborg']);
    });

    it('Moron profile returns clamped random decisions', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const profile = getAIProfile('moron');
        const decision = profile.decide(createContext('MoronAI'));

        expect(decision.angle).toBeGreaterThanOrEqual(GAME_CONFIG.ANGLE_MIN);
        expect(decision.angle).toBeLessThanOrEqual(GAME_CONFIG.ANGLE_MAX);
        expect(decision.power).toBeGreaterThanOrEqual(GAME_CONFIG.POWER_MIN);
        expect(decision.power).toBeLessThanOrEqual(GAME_CONFIG.POWER_MAX);
    });

    it('Shooter profile aims directly at the target', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const profile = getAIProfile('shooter');
        const context = createContext('ShooterAI');
        const decision = profile.decide(context);

        const dx = context.defaultTarget.x - context.shooter.x;
        const dy = context.defaultTarget.y - context.shooter.y;
        const expectedAngle = Math.atan2(dy, dx) * 180 / Math.PI;

        expect(Math.abs(decision.angle - expectedAngle)).toBeLessThan(6);
    });

    it('Tosser profile refines aim after learning from a miss', () => {
        const profile = getAIProfile('tosser');
        const shooterName = `Tosser_${Date.now()}`;
        const context = createContext(shooterName);
        const firstDecision = profile.decide(context);

        profile.onShotResult?.({
            shooter: context.shooter,
            target: context.defaultTarget,
            impactX: context.defaultTarget.x + 80,
            impactY: context.defaultTarget.y
        });

        const secondDecision = profile.decide(context);
        expect(secondDecision.angle).toBeLessThan(firstDecision.angle);
    });

    it('Spoiler profile finds a precise shot', () => {
        const profile = getAIProfile('spoiler');
        const context = createContext('SpoilerAI');
        const decision = profile.decide(context);
        const impact = simulateShot(context, decision.angle, decision.power);
        expect(Math.abs(impact.impactX - context.defaultTarget.x)).toBeLessThan(30);
    });

    it('Cyborg profile prioritizes recent attackers', () => {
        const profile = getAIProfile('cyborg');
        const context = createContext('CyborgAI');
        context.history.recentDamage = [{
            attackerName: context.enemies[1].name,
            victimName: context.shooter.name,
            amount: 20,
            timestamp: performance.now()
        }];

        const decision = profile.decide(context);
        expect(decision.targetOverride?.name).toBe(context.enemies[1].name);
    });
});

function simulateShot(
    context: AIDecisionContext,
    angle: number,
    power: number
): { impactX: number; impactY: number } {
    const angleRad = angle * Math.PI / 180;
    const speed = power * GAME_CONFIG.PROJECTILE_SPEED_MULTIPLIER;
    let vx = Math.cos(angleRad) * speed;
    let vy = Math.sin(angleRad) * speed;
    let x = context.shooter.x;
    let y = context.shooter.y;

    const simulationDt = 0.1;
    const { steps, subDt } = getProjectileIntegrationStep(simulationDt);
    const stepDt = steps > 0 ? subDt : simulationDt;
    const maxSimulatedTime = 65;
    const maxSteps = Math.ceil(maxSimulatedTime / stepDt);

    for (let i = 0; i < maxSteps; i++) {
        vy -= context.environment.gravity * stepDt;
        vx += context.environment.windSpeed * stepDt * GAME_CONFIG.WIND_EFFECT_MULTIPLIER;
        x += vx * stepDt;
        y += vy * stepDt;

        if (x < 0 || x > context.terrain.getWidth()) {
            return { impactX: x, impactY: y };
        }

        const ground = context.terrain.getHeight(x);
        if (y <= ground) {
            return { impactX: x, impactY: ground };
        }
    }

    return { impactX: x, impactY: y };
}

