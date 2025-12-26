import { GAME_CONFIG, SHOP_ITEMS, VALID_SHOP_ITEM_TYPES, VALID_WEAPON_TYPES, WEAPONS } from '../constants.js';
import { Tank } from '../tank.js';
import { Terrain } from '../terrain.js';
import { BaseProjectile, DiggerProjectile, MirvProjectile, ProjectileFactory, RollerProjectile } from '../projectiles/index.js';
import { Explosion, NapalmPool } from '../effects.js';
import { GameEnvironment } from '../environment.js';
import { applyTerrainEffect } from '../gameLogic/terrainEffects.js';
import { findClosestTankToPoint, getProjectileOrigin } from '../gameLogic/projectileUtils.js';
import { AIDecision, AICombatHistoryEntry, AI_PROFILE_OPTIONS, AIProfileId, getAIProfile } from '../ai/profiles.js';

type GameMode = '1player' | '2player';
type GamePhase = 'idle' | 'playing' | 'shop' | 'gameover';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
    type: NotificationType;
    message: string;
    duration?: number;
}

export interface HudState {
    playerName: string;
    money: number;
    angle: number;
    power: number;
    weapon: string;
    contactTriggers: number;
    contactTriggerActive: boolean;
    wind: number;
}

export interface ShopSummary {
    winnerIndex: number;
    reward: number;
}

export interface GameOverSummary {
    winnerIndex: number;
}

interface ScheduledAction {
    delay: number;
    callback: () => void;
}

interface PendingAIShot {
    shooterIndex: number;
    targetIndex: number;
    profileId: AIProfileId;
}

export class GameEngine {
    readonly width: number;
    readonly height: number;

    private terrain: Terrain | null = null;
    private tanks: Tank[] = [];
    private projectiles: BaseProjectile[] = [];
    private projectile: BaseProjectile | null = null;
    private explosions: Explosion[] = [];
    private napalmPools: NapalmPool[] = [];
    private environment: GameEnvironment = new GameEnvironment();
    private gameMode: GameMode = '1player';
    private phase: GamePhase = 'idle';
    private playerMoney: number[] = [GAME_CONFIG.INITIAL_MONEY, GAME_CONFIG.INITIAL_MONEY];
    private currentPlayerIndex = 0;
    private projectileFiredThisTurn = false;
    private turnCompletionScheduled = false;
    private round = 1;
    private notifications: Notification[] = [];
    private timers: ScheduledAction[] = [];
    private aiProfileId: AIProfileId = 'moron';
    private aiAssignments = new Map<number, AIProfileId>();
    private pendingAIShot: PendingAIShot | null = null;
    private recentDamage: AICombatHistoryEntry[] = [];
    private pendingShopSummary: ShopSummary | null = null;
    private pendingGameOver: GameOverSummary | null = null;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    public configureAIProfile(profileId: AIProfileId): void {
        this.aiProfileId = profileId;
    }

    public getPhase(): GamePhase {
        return this.phase;
    }

    public getTerrain(): Terrain | null {
        return this.terrain;
    }

    public getTanks(): readonly Tank[] {
        return this.tanks;
    }

    public getProjectiles(): readonly BaseProjectile[] {
        return this.projectiles;
    }

    public getExplosions(): readonly Explosion[] {
        return this.explosions;
    }

    public getNapalmPools(): readonly NapalmPool[] {
        return this.napalmPools;
    }

    public getEnvironment(): GameEnvironment {
        return this.environment;
    }

    public getHudState(): HudState | null {
        if (!this.isValidTankIndex(this.currentPlayerIndex)) {
            return null;
        }
        const tank = this.tanks[this.currentPlayerIndex];
        const playerName = this.gameMode === '1player' && this.currentPlayerIndex === 1
            ? 'Computer'
            : `Player ${this.currentPlayerIndex + 1}`;
        return {
            playerName,
            money: this.playerMoney[this.currentPlayerIndex] ?? 0,
            angle: Math.round(tank.angle),
            power: Math.round(tank.power),
            weapon: tank.currentWeapon,
            contactTriggers: tank.contactTriggers,
            contactTriggerActive: tank.useContactTrigger,
            wind: this.environment.windSpeed,
        };
    }

    public startGame(mode: GameMode, profile: AIProfileId): void {
        this.gameMode = mode;
        this.aiProfileId = profile;
        this.phase = 'playing';
        this.round = 1;
        this.playerMoney = [GAME_CONFIG.INITIAL_MONEY, GAME_CONFIG.INITIAL_MONEY];
        this.currentPlayerIndex = 0;
        this.projectileFiredThisTurn = false;
        this.turnCompletionScheduled = false;
        this.pendingAIShot = null;
        this.recentDamage = [];
        this.aiAssignments.clear();
        this.environment.generateWind();
        this.initializeLevel();
        if (mode === '1player') {
            this.aiAssignments.set(1, profile);
        }
        this.queueHudUpdate();
        if (this.tanks[this.currentPlayerIndex]?.isAI) {
            this.scheduleAction(GAME_CONFIG.AI_THINK_DELAY / 1000, () => this.makeAIMove());
        }
    }

    private initializeLevel(): void {
        const terrainHeight = this.height * GAME_CONFIG.TERRAIN_HEIGHT_RATIO;
        this.terrain = new Terrain(this.width, terrainHeight);

        this.tanks = [];
        const tank1X = this.width * GAME_CONFIG.TANK1_X_RATIO;
        const tank1Y = this.terrain.getHeight(tank1X);
        this.tanks.push(new Tank(tank1X, tank1Y, '#0000FF', 'Player 1', false));

        const tank2X = this.width * GAME_CONFIG.TANK2_X_RATIO;
        const tank2Y = this.terrain.getHeight(tank2X);
        const isAI = this.gameMode === '1player';
        const tank2Name = isAI ? 'Computer' : 'Player 2';
        this.tanks.push(new Tank(tank2X, tank2Y, '#FF0000', tank2Name, isAI));

        this.projectile = null;
        this.projectiles = [];
        this.explosions = [];
        this.napalmPools = [];
        this.projectileFiredThisTurn = false;
        this.turnCompletionScheduled = false;
        this.pendingAIShot = null;
    }

    public update(dt: number): void {
        if (this.phase !== 'playing') {
            return;
        }

        this.updateTimers(dt);

        for (const tank of this.tanks) {
            if (tank.isAlive()) {
                tank.updateAnimation(dt);
            }
        }

        if (this.terrain) {
            this.napalmPools = this.napalmPools.filter(pool => {
                const stillActive = pool.update(dt, this.terrain!);
                if (stillActive) {
                    for (const tank of this.tanks) {
                        if (tank.isAlive()) {
                            const damage = pool.checkDamage(tank.x, tank.y) * dt;
                            if (damage > 0) {
                                tank.takeDamage(damage);
                            }
                        }
                    }
                }
                return stillActive;
            });
        }

        if (this.projectiles.length > 0) {
            this.updateProjectiles(dt);
        } else {
            this.projectile = null;
        }

        this.explosions = this.explosions.filter(e => e.update(dt));

        if (this.terrain) {
            for (const tank of this.tanks) {
                if (tank.isAlive()) {
                    tank.y = this.terrain.getHeight(tank.x);
                }
            }
        }
    }

    private updateProjectiles(dt: number): void {
        if (!this.terrain) {
            return;
        }

        const projectilesToRemove: BaseProjectile[] = [];
        for (const proj of this.projectiles) {
            if (!proj.active) {
                projectilesToRemove.push(proj);
                continue;
            }

            proj.update(dt, this.environment.gravity, this.environment.windSpeed, this.terrain);

            if (proj instanceof MirvProjectile && proj.shouldSplit() && !proj.hasSplit) {
                proj.hasSplit = true;
                const splitAngle = Math.atan2(-proj.vy, proj.vx);
                const baseSpeed = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy);
                for (let i = 0; i < 5; i++) {
                    const angleOffset = (i - 2) * 0.3;
                    const newAngle = splitAngle + angleOffset;
                    const splitProj = ProjectileFactory.create(
                        proj.x,
                        proj.y,
                        newAngle * 180 / Math.PI,
                        baseSpeed / GAME_CONFIG.PROJECTILE_SPEED_MULTIPLIER,
                        'normal'
                    );
                    splitProj.vx = Math.cos(newAngle) * baseSpeed;
                    splitProj.vy = Math.sin(newAngle) * baseSpeed;
                    this.projectiles.push(splitProj);
                }
                projectilesToRemove.push(proj);
                continue;
            }

            const terrainHeight = this.terrain.getHeight(proj.x);
            const hitTerrain = proj.y <= terrainHeight;
            const outOfBounds = proj.x < 0 || proj.x > this.width;

            if (outOfBounds && !(proj instanceof RollerProjectile || (proj instanceof DiggerProjectile && !proj.useContactTrigger))) {
                this.handleProjectileExplosion(proj, terrainHeight);
                projectilesToRemove.push(proj);
                continue;
            }

            if (proj instanceof DiggerProjectile) {
                if (hitTerrain) {
                    if (proj.useContactTrigger) {
                        this.handleProjectileExplosion(proj, terrainHeight);
                        projectilesToRemove.push(proj);
                        continue;
                    }
                    if (proj.shouldExplode) {
                        this.handleProjectileExplosion(proj, terrainHeight);
                        projectilesToRemove.push(proj);
                        continue;
                    }
                }
                if (proj.shouldExplode) {
                    this.handleProjectileExplosion(proj, terrainHeight);
                    projectilesToRemove.push(proj);
                    continue;
                }
                if (outOfBounds) {
                    projectilesToRemove.push(proj);
                }
                continue;
            }

            if (proj instanceof RollerProjectile) {
                let hitTank = false;
                for (const tank of this.tanks) {
                    if (!tank.isAlive()) continue;
                    const dist = Math.hypot(tank.x - proj.x, tank.y - proj.y);
                    if (dist < 15) {
                        hitTank = true;
                        break;
                    }
                }
                if (hitTank) {
                    this.handleProjectileExplosion(proj, terrainHeight);
                    projectilesToRemove.push(proj);
                    continue;
                }
                if (proj.shouldExplode) {
                    this.handleProjectileExplosion(proj, terrainHeight);
                    projectilesToRemove.push(proj);
                    continue;
                }
                if (outOfBounds) {
                    this.handleProjectileExplosion(proj, terrainHeight);
                    projectilesToRemove.push(proj);
                }
                continue;
            }

            if (proj.type === 'riotcharge' && hitTerrain) {
                this.handleRiotCharge(proj, terrainHeight);
                projectilesToRemove.push(proj);
                continue;
            }

            if (hitTerrain || outOfBounds) {
                this.handleProjectileExplosion(proj, terrainHeight);
                projectilesToRemove.push(proj);
            }
        }

        for (const proj of projectilesToRemove) {
            const index = this.projectiles.indexOf(proj);
            if (index > -1) {
                this.projectiles.splice(index, 1);
            }
        }

        this.projectile = this.projectiles.length > 0 ? this.projectiles[0] : null;

        if (this.projectileFiredThisTurn && this.projectiles.length === 0 && this.projectile === null && !this.turnCompletionScheduled) {
            this.turnCompletionScheduled = true;
            this.scheduleAction(GAME_CONFIG.TURN_DELAY / 1000, () => {
                const aliveTanks = this.tanks.filter(t => t.isAlive());
                if (aliveTanks.length === 1) {
                    const winnerIndex = this.tanks.findIndex(t => t.isAlive());
                    this.endRound(winnerIndex);
                } else if (aliveTanks.length === 0) {
                    this.endRound(-1);
                } else {
                    this.nextTurn();
                }
            });
        }
    }

    private handleProjectileExplosion(proj: BaseProjectile, terrainHeight: number): void {
        if (!this.terrain) return;

        const explodeX = proj.x;
        const explodeY = Math.max(proj.y, terrainHeight);
        const explosionRadius = proj.getExplosionRadius();
        const baseDamage = proj.getDamage();

        this.explosions.push(new Explosion(explodeX, explodeY, proj.type));

        if (proj.type === 'napalm') {
            const pool = new NapalmPool(explodeX, explodeY, 50);
            this.napalmPools.push(pool);
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2;
                const dist = 15 + Math.random() * 10;
                const poolX = explodeX + Math.cos(angle) * dist;
                const poolY = explodeY + Math.sin(angle) * dist;
                this.napalmPools.push(new NapalmPool(poolX, poolY, 30));
            }
        }

        applyTerrainEffect(this.terrain, proj.type, explodeX, explodeY, explosionRadius);
        this.reportAIShotResult(explodeX, explodeY);

        for (const tank of this.tanks) {
            if (!tank.isAlive()) continue;
            const dist = Math.hypot(tank.x - explodeX, tank.y - explodeY);
            if (proj.type !== 'tracer' && dist < explosionRadius) {
                const damage = baseDamage * (1 - dist / explosionRadius);
                tank.takeDamage(damage);
                const victimIndex = this.tanks.indexOf(tank);
                this.recordDamage(this.currentPlayerIndex, victimIndex, damage);
            }
        }
    }

    private handleRiotCharge(proj: BaseProjectile, terrainHeight: number): void {
        if (!this.terrain) return;
        const origin = getProjectileOrigin(proj);
        const firingTank = findClosestTankToPoint(this.tanks, origin);
        if (!firingTank) {
            return;
        }

        const tankX = Math.floor(firingTank.x);
        const wedgeAngle = Math.PI / 3;
        const wedgeLength = 50;

        for (let angle = -wedgeAngle / 2; angle <= wedgeAngle / 2; angle += 0.1) {
            for (let dist = 0; dist < wedgeLength; dist += 2) {
                const x = tankX + Math.cos(angle) * dist;
                const y = this.terrain.getHeight(x) + Math.sin(angle) * dist;
                if (x >= 0 && x < this.terrain.getWidth()) {
                    this.terrain.explode(x, y, 5);
                }
            }
        }
    }

    public setAngle(angle: number): void {
        if (!this.isValidTankIndex(this.currentPlayerIndex)) return;
        const tank = this.tanks[this.currentPlayerIndex];
        if (tank.isAI) return;
        tank.setAngle(angle);
        this.queueHudUpdate();
    }

    public adjustAngle(delta: number): void {
        if (!this.isValidTankIndex(this.currentPlayerIndex)) return;
        const tank = this.tanks[this.currentPlayerIndex];
        if (tank.isAI) return;
        tank.setAngle(tank.angle + delta);
        this.queueHudUpdate();
    }

    public setPower(power: number): void {
        if (!this.isValidTankIndex(this.currentPlayerIndex)) return;
        const tank = this.tanks[this.currentPlayerIndex];
        if (tank.isAI) return;
        tank.setPower(power);
        this.queueHudUpdate();
    }

    public adjustPower(delta: number): void {
        if (!this.isValidTankIndex(this.currentPlayerIndex)) return;
        const tank = this.tanks[this.currentPlayerIndex];
        if (tank.isAI) return;
        tank.setPower(tank.power + delta);
        this.queueHudUpdate();
    }

    public cycleWeapon(direction: number): void {
        if (!this.isValidTankIndex(this.currentPlayerIndex)) return;
        const tank = this.tanks[this.currentPlayerIndex];
        if (tank.isAI) return;
        const currentIndex = WEAPONS.findIndex(w => w.value === tank.currentWeapon);
        const nextIndex = (currentIndex + direction + WEAPONS.length) % WEAPONS.length;
        tank.setWeapon(WEAPONS[nextIndex].value);
        this.queueHudUpdate();
    }

    public setWeapon(value: string): void {
        if (!this.isValidTankIndex(this.currentPlayerIndex)) return;
        const tank = this.tanks[this.currentPlayerIndex];
        if (tank.isAI) return;
        if (!VALID_WEAPON_TYPES.includes(value)) return;
        tank.setWeapon(value);
        this.queueHudUpdate();
    }

    public toggleContactTrigger(): void {
        if (!this.isValidTankIndex(this.currentPlayerIndex)) return;
        const tank = this.tanks[this.currentPlayerIndex];
        if (tank.isAI) return;
        if (tank.contactTriggers === 0) {
            tank.useContactTrigger = false;
        } else {
            tank.useContactTrigger = !tank.useContactTrigger;
        }
        this.queueHudUpdate();
    }

    public fire(): void {
        if (this.phase !== 'playing') return;
        if (this.projectile) return;
        if (!this.isValidTankIndex(this.currentPlayerIndex)) return;
        const currentTank = this.tanks[this.currentPlayerIndex];
        if (!currentTank.isAlive()) return;
        if (currentTank.isAI === false && !this.canAffordWeapon(this.currentPlayerIndex, currentTank.currentWeapon)) {
            this.notify('Not enough money for this weapon!', 'error');
            return;
        }

        const weaponType = currentTank.currentWeapon;
        const weapon = WEAPONS.find(w => w.value === weaponType);
        if (!weapon) {
            this.notify('Invalid weapon selected!', 'error');
            return;
        }

        const cost = weapon.cost;
        if (this.playerMoney[this.currentPlayerIndex] < cost) {
            this.notify('Not enough money for this weapon!', 'error');
            return;
        }

        this.playerMoney[this.currentPlayerIndex] -= cost;
        this.queueHudUpdate();

        const weaponConfig = currentTank.getWeaponConfig();
        const angleRad = currentTank.angle * Math.PI / 180;
        const barrelLength = weaponConfig.barrelLength;
        const barrelTipX = currentTank.x + Math.cos(angleRad) * barrelLength;
        const barrelTipY = currentTank.y + Math.sin(angleRad) * barrelLength;

        let usedContactTrigger = false;
        if (currentTank.useContactTrigger) {
            if (currentTank.contactTriggers > 0) {
                currentTank.contactTriggers--;
                usedContactTrigger = true;
                this.notify('Contact Trigger used!', 'info');
            } else {
                currentTank.useContactTrigger = false;
                this.notify('No contact triggers left!', 'warning');
            }
        }
        this.queueHudUpdate();

        this.projectile = ProjectileFactory.create(
            barrelTipX,
            barrelTipY,
            currentTank.angle,
            currentTank.power,
            weaponType,
            usedContactTrigger
        );
        this.projectiles = [this.projectile];
        this.projectileFiredThisTurn = true;
        this.turnCompletionScheduled = false;

        if (weaponType === 'laser' && this.terrain) {
            this.processLaser(currentTank);
        }
    }

    private processLaser(currentTank: Tank): void {
        if (!this.terrain || !this.projectile) return;
        const angleRad = currentTank.angle * Math.PI / 180;
        const maxRange = 2000;
        let hitSomething = false;
        let hitX = currentTank.x;
        let hitY = currentTank.y;

        for (let dist = 0; dist < maxRange && !hitSomething; dist += 5) {
            hitX = currentTank.x + Math.cos(angleRad) * dist;
            hitY = currentTank.y + Math.sin(angleRad) * dist;
            const terrainHeight = this.terrain.getHeight(hitX);
            if (hitY <= terrainHeight) {
                hitSomething = true;
                for (let d = 0; d < dist; d += 2) {
                    const x = currentTank.x + Math.cos(angleRad) * d;
                    const y = currentTank.y + Math.sin(angleRad) * d;
                    this.terrain.explode(x, y, 3);
                }
            }
            for (const tank of this.tanks) {
                if (!tank.isAlive()) continue;
                const tankDist = Math.hypot(tank.x - hitX, tank.y - hitY);
                if (tankDist < 10) {
                    hitSomething = true;
                    break;
                }
            }
            if (hitX < 0 || hitX > this.width) {
                hitSomething = true;
            }
        }

        const terrainHeight = this.terrain.getHeight(hitX);
        this.handleProjectileExplosion(this.projectile, terrainHeight);
        this.projectile.active = false;
        this.projectiles.length = 0;
        this.projectile = null;
    }

    private nextTurn(): void {
        if (this.tanks.length === 0) {
            return;
        }
        this.projectileFiredThisTurn = false;
        this.turnCompletionScheduled = false;
        const total = this.tanks.length;

        for (let i = 0; i < total; i++) {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % total;
            if (this.isValidTankIndex(this.currentPlayerIndex) && this.tanks[this.currentPlayerIndex].isAlive()) {
                break;
            }
        }

        this.queueHudUpdate();
        if (this.tanks[this.currentPlayerIndex]?.isAI) {
            this.scheduleAction(GAME_CONFIG.AI_THINK_DELAY / 1000, () => this.makeAIMove());
        }
    }

    private endRound(winnerIndex: number): void {
        if (winnerIndex >= 0) {
            this.phase = 'shop';
            const reward = GAME_CONFIG.ROUND_WIN_REWARD;
            this.pendingShopSummary = { winnerIndex, reward };
            if (winnerIndex < this.playerMoney.length) {
                this.playerMoney[winnerIndex] += reward;
            }
        } else {
            this.phase = 'gameover';
            this.pendingGameOver = { winnerIndex };
        }
    }

    public getShopSummary(): ShopSummary | null {
        return this.pendingShopSummary;
    }

    public getGameOverSummary(): GameOverSummary | null {
        return this.pendingGameOver;
    }

    public completeShopPhase(): void {
        this.pendingShopSummary = null;
        this.phase = 'playing';
        this.round++;
        this.currentPlayerIndex = 0;
        this.environment.generateWind();
        this.initializeLevel();
        this.queueHudUpdate();
        if (this.tanks[this.currentPlayerIndex]?.isAI) {
            this.scheduleAction(GAME_CONFIG.AI_THINK_DELAY / 1000, () => this.makeAIMove());
        }
    }

    public restartToMenu(): void {
        this.phase = 'idle';
        this.pendingGameOver = null;
        this.tanks = [];
        this.projectiles = [];
        this.projectile = null;
        this.explosions = [];
        this.napalmPools = [];
        this.notifications = [];
        this.timers = [];
    }

    public buyItem(item: string): void {
        if (!this.pendingShopSummary) {
            return;
        }
        if (!VALID_SHOP_ITEM_TYPES.includes(item)) {
            this.notify('Invalid item selected!', 'error');
            return;
        }
        const currentPlayerIndex = this.tanks.findIndex(t => t.isAlive());
        if (!this.isValidTankIndex(currentPlayerIndex)) {
            return;
        }
        const shopItem = SHOP_ITEMS.find(i => i.value === item);
        if (!shopItem) {
            return;
        }
        if (this.playerMoney[currentPlayerIndex] < shopItem.cost) {
            this.notify('Not enough money!', 'error');
            return;
        }
        switch (item) {
            case 'shield':
                this.tanks[currentPlayerIndex].addShield(GAME_CONFIG.SHIELD_AMOUNT);
                break;
            case 'repair':
                this.tanks[currentPlayerIndex].repair(GAME_CONFIG.REPAIR_AMOUNT);
                break;
            case 'contact_trigger':
                this.tanks[currentPlayerIndex].contactTriggers += 25;
                break;
        }
        this.playerMoney[currentPlayerIndex] -= shopItem.cost;
        this.notify(`Purchased ${shopItem.name}!`, 'success');
        this.queueHudUpdate();
    }

    public consumeNotifications(): Notification[] {
        const out = [...this.notifications];
        this.notifications.length = 0;
        return out;
    }

    private scheduleAction(delaySeconds: number, callback: () => void): void {
        this.timers.push({ delay: delaySeconds, callback });
    }

    private updateTimers(dt: number): void {
        if (this.timers.length === 0) {
            return;
        }
        const remaining: ScheduledAction[] = [];
        for (const timer of this.timers) {
            timer.delay -= dt;
            if (timer.delay <= 0) {
                timer.callback();
            } else {
                remaining.push(timer);
            }
        }
        this.timers = remaining;
    }

    private makeAIMove(): void {
        if (!this.isValidTankIndex(this.currentPlayerIndex) || !this.terrain) {
            return;
        }
        const aiTank = this.tanks[this.currentPlayerIndex];
        if (!aiTank.isAI) {
            return;
        }
        const enemies = this.tanks.filter((tank, index) => index !== this.currentPlayerIndex && tank.isAlive());
        if (enemies.length === 0) {
            return;
        }
        const defaultTarget = enemies[0];
        const profileId = this.aiAssignments.get(this.currentPlayerIndex) ?? this.aiProfileId;
        const profile = getAIProfile(profileId);
        const decision: AIDecision = profile.decide({
            shooter: aiTank,
            enemies,
            defaultTarget,
            environment: this.environment,
            terrain: this.terrain,
            history: { recentDamage: this.recentDamage },
            playerMoneyByName: this.getPlayerMoneyByName()
        });
        const target = decision.targetOverride ?? defaultTarget;
        aiTank.setAngle(decision.angle);
        aiTank.setPower(decision.power);
        let desiredWeapon = decision.weapon;
        if (desiredWeapon && !this.canAffordWeapon(this.currentPlayerIndex, desiredWeapon)) {
            desiredWeapon = undefined;
        }
        aiTank.setWeapon((desiredWeapon ?? 'normal'));
        const targetIndex = this.tanks.indexOf(target);
        if (profile.onShotResult && targetIndex >= 0) {
            this.pendingAIShot = {
                shooterIndex: this.currentPlayerIndex,
                targetIndex,
                profileId
            };
        } else {
            this.pendingAIShot = null;
        }
        this.queueHudUpdate();
        this.scheduleAction(GAME_CONFIG.AI_SHOOT_DELAY / 1000, () => this.fire());
    }

    private reportAIShotResult(x: number, y: number): void {
        if (!this.pendingAIShot) {
            return;
        }
        const { shooterIndex, targetIndex, profileId } = this.pendingAIShot;
        const shooter = this.tanks[shooterIndex];
        const target = this.tanks[targetIndex];
        const profile = getAIProfile(profileId);
        if (profile && shooter && target && typeof profile.onShotResult === 'function') {
            profile.onShotResult({ shooter, target, impactX: x, impactY: y });
        }
        this.pendingAIShot = null;
    }

    private recordDamage(attackerIndex: number, victimIndex: number, amount: number): void {
        if (amount <= 0) return;
        if (!this.isValidTankIndex(attackerIndex) || !this.isValidTankIndex(victimIndex)) {
            return;
        }
        const attacker = this.tanks[attackerIndex];
        const victim = this.tanks[victimIndex];
        this.recentDamage.unshift({
            attackerName: attacker.name,
            victimName: victim.name,
            amount,
            timestamp: performance.now(),
        });
        if (this.recentDamage.length > 10) {
            this.recentDamage.pop();
        }
    }

    private getPlayerMoneyByName(): Record<string, number> {
        const map: Record<string, number> = {};
        this.tanks.forEach((tank, index) => {
            map[tank.name] = this.playerMoney[index] ?? GAME_CONFIG.INITIAL_MONEY;
        });
        return map;
    }

    private canAffordWeapon(playerIndex: number, weaponType: string): boolean {
        const weapon = WEAPONS.find(w => w.value === weaponType);
        if (!weapon) {
            return false;
        }
        return (this.playerMoney[playerIndex] ?? 0) >= weapon.cost;
    }

    private notify(message: string, type: NotificationType): void {
        this.notifications.push({ message, type });
    }

    private queueHudUpdate(): void {
        const hud = this.getHudState();
        if (!hud) {
            return;
        }
        // Use info notification to signal UI update consumers (they can ignore type)
        this.notifications.push({ message: 'HUD_UPDATE', type: 'info' });
    }

    private isValidTankIndex(index: number): boolean {
        return index >= 0 && index < this.tanks.length && this.tanks[index] !== undefined;
    }
}

export const AI_PROFILE_OPTIONS_LIST = AI_PROFILE_OPTIONS;
