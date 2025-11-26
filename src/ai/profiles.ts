import { GAME_CONFIG, WEAPONS } from '../constants.js';
import { GameEnvironment } from '../environment.js';
import { Tank } from '../tank.js';
import { Terrain } from '../terrain.js';

export type AIProfileId = 'moron' | 'shooter' | 'tosser' | 'spoiler' | 'cyborg';

export interface AICombatHistoryEntry {
    attackerName: string;
    victimName: string;
    amount: number;
    timestamp: number;
}

export interface AICombatHistory {
    recentDamage: AICombatHistoryEntry[];
}

export interface AIDecisionContext {
    shooter: Tank;
    enemies: Tank[];
    defaultTarget: Tank;
    environment: GameEnvironment;
    terrain: Terrain;
    history: AICombatHistory;
    playerMoneyByName: Record<string, number>;
}

export interface AIShotResult {
    shooter: Tank;
    target: Tank;
    impactX: number;
    impactY: number;
}

export interface AIDecision {
    angle: number;
    power: number;
    weapon?: string;
    targetOverride?: Tank;
}

export abstract class BaseAIProfile {
    constructor(
        public readonly id: AIProfileId,
        public readonly label: string,
        public readonly description: string
    ) {}

    abstract decide(context: AIDecisionContext): AIDecision;

    onShotResult?(_result: AIShotResult): void;
}

interface ShotSimulationResult {
    angle: number;
    power: number;
    impactX: number;
    impactY: number;
    error: number;
}

class MoronAI extends BaseAIProfile {
    decide(context: AIDecisionContext): AIDecision {
        const target = context.defaultTarget;
        const dx = target.x - context.shooter.x;
        const dy = context.shooter.y - target.y;

        let angle = toDegrees(Math.atan2(-dy, dx));
        angle = clamp(angle, GAME_CONFIG.ANGLE_MIN, GAME_CONFIG.ANGLE_MAX);
        angle += (Math.random() - 0.5) * 40;
        angle = clamp(angle, GAME_CONFIG.ANGLE_MIN, GAME_CONFIG.ANGLE_MAX);

        const distance = Math.sqrt(dx * dx + dy * dy);
        let power = Math.min(GAME_CONFIG.POWER_MAX, distance / 10);
        power += (Math.random() - 0.5) * 30;
        power = clamp(power, GAME_CONFIG.POWER_MIN, GAME_CONFIG.POWER_MAX);

        return { angle, power };
    }
}

class ShooterAI extends BaseAIProfile {
    decide(context: AIDecisionContext): AIDecision {
        const target = context.defaultTarget;
        const dx = target.x - context.shooter.x;
        const dy = target.y - context.shooter.y;

        let angle = toDegrees(Math.atan2(dy, dx));
        angle = clamp(angle, GAME_CONFIG.ANGLE_MIN, GAME_CONFIG.ANGLE_MAX);
        angle += (Math.random() - 0.5) * 6;
        angle = clamp(angle, GAME_CONFIG.ANGLE_MIN, GAME_CONFIG.ANGLE_MAX);

        const distance = Math.sqrt(dx * dx + dy * dy);
        let power = distance / 8;
        power += (Math.random() - 0.5) * 10;
        power = clamp(power, GAME_CONFIG.POWER_MIN + 5, GAME_CONFIG.POWER_MAX - 5);

        return { angle, power };
    }
}

class TosserAI extends BaseAIProfile {
    private memory = new Map<string, { targetName: string; errorX: number }>();
    private pendingShots = new Map<string, { targetName: string }>();

    decide(context: AIDecisionContext): AIDecision {
        const baseline = searchShotSolution({
            shooter: context.shooter,
            target: context.defaultTarget,
            environment: context.environment,
            terrain: context.terrain,
            angleStep: 5,
            powerStep: 5
        }) ?? this.generateFallback(context);

        let { angle, power } = baseline;

        const shooterKey = context.shooter.name;
        const memory = this.memory.get(shooterKey);
        if (memory && memory.targetName === context.defaultTarget.name) {
            const adjustment = clamp(memory.errorX * 0.05, -8, 8);
            angle = clamp(angle - adjustment, GAME_CONFIG.ANGLE_MIN + 5, GAME_CONFIG.ANGLE_MAX - 5);
            power = clamp(power - adjustment * 0.3, GAME_CONFIG.POWER_MIN, GAME_CONFIG.POWER_MAX);
        }

        this.pendingShots.set(shooterKey, { targetName: context.defaultTarget.name });
        return { angle, power };
    }

    onShotResult(result: AIShotResult): void {
        const pending = this.pendingShots.get(result.shooter.name);
        if (!pending || pending.targetName !== result.target.name) {
            return;
        }

        const errorX = result.impactX - result.target.x;
        this.memory.set(result.shooter.name, { targetName: result.target.name, errorX });
        this.pendingShots.delete(result.shooter.name);
    }

    private generateFallback(context: AIDecisionContext): { angle: number; power: number } {
        const moron = new MoronAI('moron', '', '');
        return moron.decide(context);
    }
}

class SpoilerAI extends BaseAIProfile {
    decide(context: AIDecisionContext): AIDecision {
        const precise = searchShotSolution({
            shooter: context.shooter,
            target: context.defaultTarget,
            environment: context.environment,
            terrain: context.terrain,
            angleStep: 2,
            powerStep: 2
        });

        if (precise) {
            return { angle: precise.angle, power: precise.power };
        }

        return fallbackShooterDecision(context);
    }
}

class CyborgAI extends BaseAIProfile {
    decide(context: AIDecisionContext): AIDecision {
        const target = this.selectTarget(context);
        const precise = searchShotSolution({
            shooter: context.shooter,
            target,
            environment: context.environment,
            terrain: context.terrain,
            angleStep: 1.5,
            powerStep: 1.5
        });

        const weapon = this.pickWeapon(context);

        if (precise) {
            const angle = clamp(precise.angle + (Math.random() - 0.5) * 2, GAME_CONFIG.ANGLE_MIN, GAME_CONFIG.ANGLE_MAX);
            const power = clamp(precise.power + (Math.random() - 0.5) * 2, GAME_CONFIG.POWER_MIN, GAME_CONFIG.POWER_MAX);
            return { angle, power, weapon, targetOverride: target };
        }

        const fallback = fallbackShooterDecision({ ...context, defaultTarget: target });
        return { ...fallback, weapon, targetOverride: target };
    }

    private selectTarget(context: AIDecisionContext): Tank {
        const shooterName = context.shooter.name;
        const revenge = context.history.recentDamage.find(entry => entry.victimName === shooterName);
        if (revenge) {
            const avenger = context.enemies.find(enemy => enemy.name === revenge.attackerName && enemy.isAlive());
            if (avenger) {
                return avenger;
            }
        }

        const weakest = [...context.enemies].sort((a, b) => a.health - b.health)[0] ?? context.defaultTarget;
        const richest = [...context.enemies].sort((a, b) => {
            const moneyA = context.playerMoneyByName[a.name] ?? GAME_CONFIG.INITIAL_MONEY;
            const moneyB = context.playerMoneyByName[b.name] ?? GAME_CONFIG.INITIAL_MONEY;
            return moneyB - moneyA;
        })[0];

        if (weakest.health < context.shooter.health * 0.8) {
            return weakest;
        }

        return richest ?? context.defaultTarget;
    }

    private pickWeapon(context: AIDecisionContext): string | undefined {
        const money = context.playerMoneyByName[context.shooter.name] ?? GAME_CONFIG.INITIAL_MONEY;
        if (money > 900 && hasWeapon('nuke')) {
            return 'nuke';
        }
        if (money > 400 && hasWeapon('mirv')) {
            return 'mirv';
        }
        if (money > 300 && hasWeapon('napalm')) {
            return 'napalm';
        }
        return undefined;
    }
}

const PROFILE_METADATA: Array<{ id: AIProfileId; label: string; description: string }> = [
    { id: 'moron', label: 'Moron', description: 'Wild, random shots that rarely land.' },
    { id: 'shooter', label: 'Shooter', description: 'Aims straight at you without compensating for physics.' },
    { id: 'tosser', label: 'Tosser', description: 'Learns from previous misses and dials in over time.' },
    { id: 'spoiler', label: 'Spoiler', description: 'Calculates near-perfect artillery arcs.' },
    { id: 'cyborg', label: 'Cyborg', description: 'Strategic opponent that picks targets and weapons carefully.' }
];

const PROFILE_REGISTRY: Record<AIProfileId, BaseAIProfile> = {
    moron: new MoronAI('moron', 'Moron', PROFILE_METADATA[0].description),
    shooter: new ShooterAI('shooter', 'Shooter', PROFILE_METADATA[1].description),
    tosser: new TosserAI('tosser', 'Tosser', PROFILE_METADATA[2].description),
    spoiler: new SpoilerAI('spoiler', 'Spoiler', PROFILE_METADATA[3].description),
    cyborg: new CyborgAI('cyborg', 'Cyborg', PROFILE_METADATA[4].description)
};

export const AI_PROFILE_OPTIONS = PROFILE_METADATA;

export function getAIProfile(id: AIProfileId): BaseAIProfile {
    return PROFILE_REGISTRY[id];
}

export function getAIProfileDescription(id: AIProfileId): string {
    return PROFILE_METADATA.find(profile => profile.id === id)?.description ?? '';
}

function fallbackShooterDecision(context: AIDecisionContext): AIDecision {
    const fallbackShooter = PROFILE_REGISTRY.shooter;
    return fallbackShooter.decide(context);
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function toDegrees(value: number): number {
    return value * 180 / Math.PI;
}

function hasWeapon(value: string): boolean {
    return WEAPONS.some(weapon => weapon.value === value);
}

function searchShotSolution(params: {
    shooter: Tank;
    target: Tank;
    environment: GameEnvironment;
    terrain: Terrain;
    angleStep: number;
    powerStep: number;
}): ShotSimulationResult | null {
    let best: ShotSimulationResult | null = null;
    for (let angle = 15; angle <= 80; angle += params.angleStep) {
        for (let power = GAME_CONFIG.POWER_MIN; power <= GAME_CONFIG.POWER_MAX; power += params.powerStep) {
            const impact = simulateShot(params.shooter, angle, power, params.environment, params.terrain);
            const errorX = Math.abs(impact.impactX - params.target.x);
            const errorY = Math.abs(impact.impactY - params.target.y);
            const error = errorX + errorY * 0.2;

            if (!best || error < best.error) {
                best = { angle, power, impactX: impact.impactX, impactY: impact.impactY, error };
                if (error < 5) {
                    return best;
                }
            }
        }
    }
    return best;
}

function simulateShot(
    shooter: Tank,
    angle: number,
    power: number,
    environment: GameEnvironment,
    terrain: Terrain
): { impactX: number; impactY: number } {
    const angleRad = angle * Math.PI / 180;
    const speed = power * GAME_CONFIG.PROJECTILE_SPEED_MULTIPLIER;
    let vx = Math.cos(angleRad) * speed;
    let vy = Math.sin(angleRad) * speed;
    let x = shooter.x;
    let y = shooter.y;

    const dt = GAME_CONFIG.DEFAULT_DELTA_TIME;
    const animationDt = dt * GAME_CONFIG.PROJECTILE_ANIMATION_SPEED_MULTIPLIER;
    const maxIterations = 600;

    for (let i = 0; i < maxIterations; i++) {
        vy -= environment.gravity * dt;
        vx += environment.windSpeed * dt * GAME_CONFIG.WIND_EFFECT_MULTIPLIER;
        x += vx * animationDt;
        y += vy * animationDt;

        if (x < 0 || x > terrain.getWidth()) {
            break;
        }

        const ground = terrain.getHeight(x);
        if (y <= ground) {
            return { impactX: x, impactY: ground };
        }
    }

    return { impactX: x, impactY: y };
}

