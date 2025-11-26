import { Terrain } from './terrain.js';
import { Tank } from './tank.js';
import { Explosion, NapalmPool } from './effects.js';
import { GameEnvironment } from './environment.js';
import { BaseProjectile, ProjectileFactory, RollerProjectile, FunkyProjectile, MirvProjectile, NapalmProjectile, DiggerProjectile } from './projectiles/index.js';
import { GAME_CONFIG, WEAPONS, SHOP_ITEMS, VALID_WEAPON_TYPES } from './constants.js';
const VALID_SHOP_ITEM_TYPES = [...SHOP_ITEMS.map(i => i.value), 'contact_trigger'] as const;
import { AI_PROFILE_OPTIONS, AIProfileId, AIDecision, AICombatHistoryEntry, getAIProfile, getAIProfileDescription } from './ai/profiles.js';
import { applyTerrainEffect } from './gameLogic/terrainEffects.js';
import { findClosestTankToPoint, getProjectileOrigin } from './gameLogic/projectileUtils.js';

class GameController {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private terrain: Terrain | null = null;
    private tanks: Tank[] = [];
    private projectile: BaseProjectile | null = null;
    private projectiles: BaseProjectile[] = []; // For MIRV splits
    private explosions: Explosion[] = [];
    private napalmPools: NapalmPool[] = [];
    private environment: GameEnvironment;
    private projectileFiredThisTurn: boolean = false;
    private turnCompletionScheduled: boolean = false;
    private currentPlayerIndex: number = 0;
    private gameMode: '1player' | '2player' = '1player';
    private gameState: 'menu' | 'playing' | 'shop' | 'gameover' = 'menu';
    private playerMoney: number[] = [1000, 1000];
    private round: number = 1;
    private lastTime: number = 0;
    private animationId: number = 0;
    private aiProfileId: AIProfileId = 'moron';
    private aiProfileSelect: HTMLSelectElement | null = null;
    private aiProfileDescription: HTMLElement | null = null;
    private aiAssignments = new Map<number, AIProfileId>();
    private pendingAIShot: { shooterIndex: number; targetIndex: number; profileId: AIProfileId } | null = null;
    private recentDamage: AICombatHistoryEntry[] = [];

    constructor() {
        const canvasElement = document.getElementById('game-canvas');
        if (!canvasElement || !(canvasElement instanceof HTMLCanvasElement)) {
            throw new Error('Game canvas element not found');
        }
        this.canvas = canvasElement;

        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D rendering context');
        }
        this.ctx = ctx;

        this.environment = new GameEnvironment();
        this.setupCanvas();
        this.setupEventListeners();
        this.setupAIProfileSelector();
        this.registerServiceWorker();
    }

    private setupCanvas(): void {
        const resize = () => {
            this.canvas.width = this.canvas.offsetWidth;
            this.canvas.height = this.canvas.offsetHeight;
        };
        resize();
        window.addEventListener('resize', resize);
    }

    private registerServiceWorker(): void {
        if ('serviceWorker' in navigator) {
            // Check if we're in development mode
            const isDevelopment = window.location.hostname === 'localhost' ||
                                  window.location.hostname === '127.0.0.1' ||
                                  window.location.hostname === '[::1]';

            if (isDevelopment) {
                // In development, unregister any existing service workers and clear caches
                this.unregisterServiceWorkers();
                console.log('[Development] Service Worker registration skipped');
                return;
            }

            navigator.serviceWorker.register('./service-worker.js')
                .then(() => console.log('Service Worker registered'))
                .catch(err => console.error('Service Worker registration failed:', err));
        }
    }

    private async unregisterServiceWorkers(): Promise<void> {
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                    console.log('[Development] Service Worker unregistered');
                }

                // Clear all caches
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames.map(cacheName => {
                        console.log(`[Development] Deleting cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    })
                );
                console.log('[Development] All caches cleared');
            } catch (err) {
                console.error('[Development] Error unregistering service workers:', err);
            }
        }
    }

    /**
     * Expose service worker management to window for console access
     * Usage in console: window.unregisterServiceWorkers()
     */
    public static exposeServiceWorkerHelpers(): void {
        if (typeof window !== 'undefined') {
            (window as any).unregisterServiceWorkers = async () => {
                if ('serviceWorker' in navigator) {
                    try {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (const registration of registrations) {
                            await registration.unregister();
                            console.log('Service Worker unregistered');
                        }

                        const cacheNames = await caches.keys();
                        await Promise.all(
                            cacheNames.map(cacheName => caches.delete(cacheName))
                        );
                        console.log('All caches cleared. Reload the page.');
                    } catch (err) {
                        console.error('Error unregistering service workers:', err);
                    }
                }
            };
            console.log('💡 Development helper: Use window.unregisterServiceWorkers() to manually clear service workers and caches');
        }
    }

    private setupEventListeners(): void {
        // Menu buttons
        document.getElementById('btn-1player')?.addEventListener('click', () => {
            this.startGame('1player');
        });

        document.getElementById('btn-2player')?.addEventListener('click', () => {
            this.startGame('2player');
        });

        // Game controls
        document.getElementById('angle')?.addEventListener('input', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value, 10);
            if (isNaN(value)) {
                console.error('Invalid angle value');
                return;
            }

            const angleValueElement = document.getElementById('angle-value');
            if (angleValueElement) {
                angleValueElement.textContent = value.toString();
            }

            if (this.isValidTankIndex(this.currentPlayerIndex) && !this.tanks[this.currentPlayerIndex].isAI) {
                this.tanks[this.currentPlayerIndex].setAngle(value);
            }
        });

        document.getElementById('power')?.addEventListener('input', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value, 10);
            if (isNaN(value)) {
                console.error('Invalid power value');
                return;
            }

            const powerValueElement = document.getElementById('power-value');
            if (powerValueElement) {
                powerValueElement.textContent = value.toString();
            }

            const powerInput = document.getElementById('power') as HTMLInputElement;
            if (powerInput) {
                powerInput.value = value.toString();
            }

            if (this.isValidTankIndex(this.currentPlayerIndex) && !this.tanks[this.currentPlayerIndex].isAI) {
                this.tanks[this.currentPlayerIndex].setPower(value);
            }
        });

        document.getElementById('btn-fire')?.addEventListener('click', () => {
            this.fire();
        });

        // Weapon select change listener
        document.getElementById('weapon')?.addEventListener('change', (e) => {
            const weaponType = (e.target as HTMLSelectElement).value;
            if (this.isValidTankIndex(this.currentPlayerIndex) && !this.tanks[this.currentPlayerIndex].isAI) {
                this.tanks[this.currentPlayerIndex].setWeapon(weaponType);
            }
        });

        // Shop/menu buttons
        document.getElementById('btn-next-round')?.addEventListener('click', () => {
            this.nextRound();
        });

        document.getElementById('btn-menu')?.addEventListener('click', () => {
            this.showScreen('menu');
        });

        document.getElementById('btn-toggle-contact-trigger')?.addEventListener('click', () => {
            if (this.isValidTankIndex(this.currentPlayerIndex) && !this.tanks[this.currentPlayerIndex].isAI) {
                const currentTank = this.tanks[this.currentPlayerIndex];
                currentTank.useContactTrigger = !currentTank.useContactTrigger;
                this.updateContactTriggerDisplay();
            }
        });

        // Shop buy buttons
        document.querySelectorAll('.buy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = (e.target as HTMLElement).getAttribute('data-item');
                if (!item) {
                    console.error('No item specified in buy button');
                    return;
                }
                this.buyItem(item);
            });
        });

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (this.gameState === 'playing' && !this.projectile) {
                if (!this.isValidTankIndex(this.currentPlayerIndex)) {
                    return;
                }
                const currentTank = this.tanks[this.currentPlayerIndex];
                if (!currentTank.isAI) {
                    switch (e.key) {
                        case 'ArrowLeft':
                            currentTank.setAngle(currentTank.angle + 1);
                            this.updateAngleDisplay();
                            break;
                        case 'ArrowRight':
                            currentTank.setAngle(currentTank.angle - 1);
                            this.updateAngleDisplay();
                            break;
                        case 'ArrowUp':
                            currentTank.setPower(currentTank.power + 1);
                            this.updatePowerDisplay();
                            break;
                        case 'ArrowDown':
                            currentTank.setPower(currentTank.power - 1);
                            this.updatePowerDisplay();
                            break;
                        case ' ':
                        case 'Enter':
                            e.preventDefault();
                            this.fire();
                            break;
                    }
                }
            }
        });
    }

    private setupAIProfileSelector(): void {
        const select = document.getElementById('ai-profile') as HTMLSelectElement | null;
        const description = document.getElementById('ai-profile-description');
        if (!select || !description) {
            return;
        }

        this.aiProfileSelect = select;
        this.aiProfileDescription = description;

        select.innerHTML = '';
        AI_PROFILE_OPTIONS.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.id;
            opt.textContent = option.label;
            select.appendChild(opt);
        });

        select.value = this.aiProfileId;
        this.updateAIProfileDescription(this.aiProfileId);

        select.addEventListener('change', (event) => {
            const value = (event.target as HTMLSelectElement).value as AIProfileId;
            this.aiProfileId = value;
            this.updateAIProfileDescription(value);
        });
    }

    private updateAIProfileDescription(id: AIProfileId): void {
        if (this.aiProfileDescription) {
            this.aiProfileDescription.textContent = getAIProfileDescription(id);
        }
    }

    private updateAngleDisplay(): void {
        if (!this.isValidTankIndex(this.currentPlayerIndex)) {
            return;
        }
        const angle = this.tanks[this.currentPlayerIndex].angle;
        const angleValueElement = document.getElementById('angle-value');
        if (angleValueElement) {
            angleValueElement.textContent = Math.round(angle).toString();
        }
        const angleInput = document.getElementById('angle') as HTMLInputElement;
        if (angleInput) {
            angleInput.value = Math.round(angle).toString();
        }
    }

    private updatePowerDisplay(): void {
        if (!this.isValidTankIndex(this.currentPlayerIndex)) {
            return;
        }
        const power = this.tanks[this.currentPlayerIndex].power;
        const powerValueElement = document.getElementById('power-value');
        if (powerValueElement) {
            powerValueElement.textContent = Math.round(power).toString();
        }
        const powerInput = document.getElementById('power') as HTMLInputElement;
        if (powerInput) {
            powerInput.value = Math.round(power).toString();
        }
    }

    private startGame(mode: '1player' | '2player'): void {
        this.gameMode = mode;
        this.gameState = 'playing';
        this.round = 1;
        this.playerMoney = [GAME_CONFIG.INITIAL_MONEY, GAME_CONFIG.INITIAL_MONEY];
        this.currentPlayerIndex = 0;
        this.projectileFiredThisTurn = false;
        this.turnCompletionScheduled = false;
        this.recentDamage = [];
        this.pendingAIShot = null;
        this.showScreen('game');

        // Ensure canvas dimensions are set after screen is visible
        requestAnimationFrame(() => {
            this.canvas.width = this.canvas.offsetWidth;
            this.canvas.height = this.canvas.offsetHeight;
            this.initializeLevel();
            this.updateHUD();
            this.gameLoop(0);
        });
    }

    private initializeLevel(): void {
        // Create terrain
        this.terrain = new Terrain(this.canvas.width, this.canvas.height * GAME_CONFIG.TERRAIN_HEIGHT_RATIO);

        // Generate new wind for this round
        this.environment.generateWind();

        // Create tanks
        this.tanks = [];
        const tank1X = this.canvas.width * GAME_CONFIG.TANK1_X_RATIO;
        const tank1Y = this.terrain.getHeight(tank1X);
        this.tanks.push(new Tank(tank1X, tank1Y, '#0000FF', 'Player 1', false));

        const tank2X = this.canvas.width * GAME_CONFIG.TANK2_X_RATIO;
        const tank2Y = this.terrain.getHeight(tank2X);
        const isAI = this.gameMode === '1player';
        const tank2Name = isAI ? 'Computer' : 'Player 2';
        this.tanks.push(new Tank(tank2X, tank2Y, '#FF0000', tank2Name, isAI));

        this.aiAssignments.clear();
        if (isAI) {
            this.aiAssignments.set(1, this.aiProfileId);
        }

        this.projectile = null;
        this.projectiles = [];
        this.explosions = [];
        this.napalmPools = [];
        this.projectileFiredThisTurn = false;
        this.turnCompletionScheduled = false;
        this.pendingAIShot = null;
    }

    private fire(): void {
        if (this.projectile) return;

        if (!this.isValidTankIndex(this.currentPlayerIndex)) {
            console.error('Invalid tank index when firing');
            return;
        }

        const currentTank = this.tanks[this.currentPlayerIndex];
        const weaponType = currentTank.currentWeapon;

        // Validate weapon type
        if (!VALID_WEAPON_TYPES.includes(weaponType)) {
            console.error(`Invalid weapon type: ${weaponType}`);
            this.showToast('Invalid weapon selected!', 'error');
            return;
        }

        // Get weapon config
        const weapon = WEAPONS.find(w => w.value === weaponType);
        if (!weapon) {
            console.error(`Weapon config not found for: ${weaponType}`);
            return;
        }

        // Check if player can afford the weapon
        const cost = weapon.cost;
        if (this.playerMoney[this.currentPlayerIndex] < cost) {
            this.showToast('Not enough money for this weapon!', 'error');
            return;
        }

        this.playerMoney[this.currentPlayerIndex] -= cost;
        this.updateHUD();

        // Calculate barrel tip position
        const weaponConfig = currentTank.getWeaponConfig();
        const barrelLength = weaponConfig.barrelLength;
        const angleRad = currentTank.angle * Math.PI / 180;
        const barrelTipX = currentTank.x + Math.cos(angleRad) * barrelLength;
        let usedContactTrigger = false;
        if (currentTank.useContactTrigger) {
            if (currentTank.contactTriggers > 0) {
                currentTank.contactTriggers--;
                usedContactTrigger = true;
                this.showToast('Contact Trigger used!', 'info');
            } else {
                currentTank.useContactTrigger = false;
                this.showToast('No contact triggers left!', 'warning');
            } 
        }
        this.updateHUD(); // Update HUD to reflect trigger count changes

        const barrelTipY = currentTank.y + Math.sin(angleRad) * barrelLength;

        this.projectile = ProjectileFactory.create(
            barrelTipX,
            barrelTipY,
            currentTank.angle,
            currentTank.power,
            weaponType,
            usedContactTrigger
        );
        this.projectiles = [this.projectile]; // Initialize projectiles array
        this.projectileFiredThisTurn = true;
        this.turnCompletionScheduled = false;

        // Laser processes immediately
        if (weaponType === 'laser' && this.terrain) {
            // Process laser collision immediately
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
                    if (tank.isAlive()) {
                        const tankDist = Math.sqrt(
                            Math.pow(tank.x - hitX, 2) +
                            Math.pow(tank.y - hitY, 2)
                        );
                        if (tankDist < 10) {
                            hitSomething = true;
                            break;
                        }
                    }
                }

                if (hitX < 0 || hitX > this.canvas.width) {
                    hitSomething = true;
                }
            }

            if (hitSomething) {
                this.handleProjectileExplosion(this.projectile, this.terrain.getHeight(hitX));
                this.projectile.active = false;
                // Remove laser from projectiles array immediately
                const index = this.projectiles.indexOf(this.projectile);
                if (index > -1) {
                    this.projectiles.splice(index, 1);
                }
                this.projectile = null;
            } else {
                // Laser hit nothing, still remove it
                this.projectile.active = false;
                const index = this.projectiles.indexOf(this.projectile);
                if (index > -1) {
                    this.projectiles.splice(index, 1);
                }
                this.projectile = null;
            }
        }
    }

    private nextRound(): void {
        this.round++;
        this.currentPlayerIndex = 0; // Reset to first player
        this.showScreen('game');

        // Ensure canvas dimensions are set
        requestAnimationFrame(() => {
            this.canvas.width = this.canvas.offsetWidth;
            this.canvas.height = this.canvas.offsetHeight;
            this.initializeLevel();
            this.updateHUD();
            this.lastTime = 0; // Reset time for game loop
            this.gameLoop(0); // Restart game loop
        });
    }

    private showScreen(screen: 'menu' | 'game' | 'shop' | 'gameover'): void {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

        switch (screen) {
            case 'menu':
                document.getElementById('menu-screen')?.classList.add('active');
                this.gameState = 'menu';
                cancelAnimationFrame(this.animationId);
                break;
            case 'game':
                document.getElementById('game-screen')?.classList.add('active');
                this.gameState = 'playing';
                break;
            case 'shop':
                const shopScreen = document.getElementById('shop-screen');
                if (shopScreen) {
                    shopScreen.classList.add('active');
                    this.gameState = 'shop';
                    this.showShop();
                    // Scroll to top after DOM update
                    requestAnimationFrame(() => {
                        shopScreen.scrollTop = 0;
                    });
                }
                break;
            case 'gameover':
                document.getElementById('game-over-screen')?.classList.add('active');
                this.gameState = 'gameover';
                break;
        }
    }

    private showShop(): void {
        const winner = this.tanks.findIndex(t => t.isAlive());
        const results = document.getElementById('round-results');

        if (winner >= 0 && this.isValidTankIndex(winner)) {
            if (results) {
                results.textContent = `Round ${this.round} - ${this.tanks[winner].name} wins! +$${GAME_CONFIG.ROUND_WIN_REWARD}`;
            }
            if (winner < this.playerMoney.length) {
                this.playerMoney[winner] += GAME_CONFIG.ROUND_WIN_REWARD;
            }
        }
    }

    private buyItem(item: string): void {
        // Validate item type
        if (!VALID_SHOP_ITEM_TYPES.includes(item)) {
            console.error(`Invalid shop item: ${item}`);
            this.showToast('Invalid item selected!', 'error');
            return;
        }

        const currentPlayerIndex = this.tanks.findIndex(t => t.isAlive());
        if (currentPlayerIndex < 0 || !this.isValidTankIndex(currentPlayerIndex)) {
            console.error('No alive tank found for purchase');
            return;
        }

        if (currentPlayerIndex >= this.playerMoney.length) {
            console.error('Player money array index out of bounds');
            return;
        }

        // Find shop item config
        const shopItem = SHOP_ITEMS.find(i => i.value === item);
        if (!shopItem) {
            console.error(`Shop item config not found for: ${item}`);
            return;
        }

        const cost = shopItem.cost;
        let success = false;

        if (this.playerMoney[currentPlayerIndex] >= cost) {
            switch (item) {
                case 'shield':
                    this.tanks[currentPlayerIndex].addShield(GAME_CONFIG.SHIELD_AMOUNT);
                    this.playerMoney[currentPlayerIndex] -= cost;
                    success = true;
                    break;
                case 'repair':
                    this.tanks[currentPlayerIndex].repair(GAME_CONFIG.REPAIR_AMOUNT);
                    this.playerMoney[currentPlayerIndex] -= cost;
                    success = true;
                    break;
                case 'contact_trigger':
                    this.tanks[currentPlayerIndex].contactTriggers += 25;
                    this.playerMoney[currentPlayerIndex] -= cost;
                    success = true;
                    break;
            }
        }

        if (success) {
            this.showToast(`Purchased ${shopItem.name}! Remaining: $${this.playerMoney[currentPlayerIndex]}`, 'success');
        } else {
            this.showToast('Not enough money!', 'error');
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

    private updateHUD(): void {
        if (!this.isValidTankIndex(this.currentPlayerIndex)) {
            return;
        }

        const playerName = this.gameMode === '1player' && this.currentPlayerIndex === 1
            ? 'Computer'
            : `Player ${this.currentPlayerIndex + 1}`;

        const currentPlayerElement = document.getElementById('current-player');
        if (currentPlayerElement) {
            currentPlayerElement.textContent = playerName;
        }

        const moneyElement = document.getElementById('money');
        if (moneyElement && this.currentPlayerIndex < this.playerMoney.length) {
            moneyElement.textContent = `Money: $${this.playerMoney[this.currentPlayerIndex]}`;
        }

        this.updateAngleDisplay();
        this.updatePowerDisplay();
        this.updateContactTriggerDisplay();
    }

    private updateContactTriggerDisplay(): void {
        if (!this.isValidTankIndex(this.currentPlayerIndex)) {
            return;
        }
        const currentTank = this.tanks[this.currentPlayerIndex];
        const countElement = document.getElementById('contact-triggers-count');
        const toggleButton = document.getElementById('btn-toggle-contact-trigger') as HTMLButtonElement;

        if (countElement) {
            countElement.textContent = currentTank.contactTriggers.toString();
        }

        if (toggleButton) {
            if (currentTank.contactTriggers === 0) {
                toggleButton.textContent = 'N/A';
                toggleButton.disabled = true;
                currentTank.useContactTrigger = false; // Ensure it's off if no triggers
            } else {
                toggleButton.disabled = false;
                toggleButton.textContent = currentTank.useContactTrigger ? 'On' : 'Off';
            }
        }
    }

    private gameLoop(timestamp: number): void {
        if (this.gameState !== 'playing') return;

        const dt = this.lastTime
            ? Math.min((timestamp - this.lastTime) / 1000, GAME_CONFIG.MAX_DELTA_TIME)
            : GAME_CONFIG.DEFAULT_DELTA_TIME;
        this.lastTime = timestamp;

        this.update(dt);
        this.render();

        this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
    }

    private update(dt: number): void {
        // Update tank animations
        for (const tank of this.tanks) {
            if (tank.isAlive()) {
                tank.updateAnimation(dt);
            }
        }

        // Update current weapon for tanks based on weapon select
        if (this.isValidTankIndex(this.currentPlayerIndex) && !this.tanks[this.currentPlayerIndex].isAI) {
            const weaponSelect = document.getElementById('weapon') as HTMLSelectElement;
            if (weaponSelect) {
                this.tanks[this.currentPlayerIndex].setWeapon(weaponSelect.value);
            }
        }

        // Update napalm pools
        if (this.terrain) {
            this.napalmPools = this.napalmPools.filter(pool => {
                const stillActive = pool.update(dt, this.terrain!);
                if (stillActive) {
                    // Apply damage to tanks in pool
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

        // Update projectiles (including MIRV splits)
        // Only update if there are projectiles to avoid unnecessary processing
        if (this.projectiles.length > 0) {
            const projectilesToRemove: BaseProjectile[] = [];
            for (const proj of this.projectiles) {
                if (!proj.active) {
                    projectilesToRemove.push(proj);
                    continue;
                }

                if (!this.terrain) {
                    console.error('Terrain not initialized');
                    continue;
                }

                // Update projectile
                proj.update(dt, this.environment.gravity, this.environment.windSpeed, this.terrain);

                // Check for MIRV split at apogee
                if (proj instanceof MirvProjectile && proj.shouldSplit() && !proj.hasSplit) {
                    proj.hasSplit = true;
                    // Create 5 warheads that fan out
                    const splitAngle = Math.atan2(-proj.vy, proj.vx);
                    const baseSpeed = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy);
                    for (let i = 0; i < 5; i++) {
                        const angleOffset = (i - 2) * 0.3; // Fan out ±0.6 radians
                        const newAngle = splitAngle + angleOffset;
                        const splitProj = ProjectileFactory.create(
                            proj.x,
                            proj.y,
                            newAngle * 180 / Math.PI,
                            baseSpeed / GAME_CONFIG.PROJECTILE_SPEED_MULTIPLIER,
                            'normal' // Split warheads are normal projectiles
                        );
                        splitProj.vx = Math.cos(newAngle) * baseSpeed;
                        splitProj.vy = Math.sin(newAngle) * baseSpeed;
                        this.projectiles.push(splitProj);
                    }
                    projectilesToRemove.push(proj);
                    continue;
                }

                // Laser is processed immediately on fire, skip here
                if (proj.type === 'laser') {
                    if (!proj.active) {
                        // Already processed, remove it
                        projectilesToRemove.push(proj);
                    }
                    continue;
                }

                const terrainHeight = this.terrain.getHeight(proj.x);
                const hitTerrain = proj.y <= terrainHeight;
                const outOfBounds = proj.x < 0 || proj.x > this.canvas.width;

                // Handle out of bounds immediately for most projectiles
                if (outOfBounds && !((proj instanceof RollerProjectile) || (proj instanceof DiggerProjectile && !proj.useContactTrigger))) {
                    this.handleProjectileExplosion(proj, terrainHeight);
                    projectilesToRemove.push(proj);
                    continue;
                }

                // Digger Projectile specific handling
                if (proj instanceof DiggerProjectile) {
                    if (hitTerrain) {
                        // If contact trigger is active, it explodes on contact, overriding tunneling
                        if (proj.useContactTrigger) {
                            this.handleProjectileExplosion(proj, terrainHeight);
                            projectilesToRemove.push(proj);
                            continue;
                        }
                        // Check end conditions signaled by projectile
                        if (proj.shouldExplode) {
                            this.handleProjectileExplosion(proj, terrainHeight);
                            projectilesToRemove.push(proj);
                            continue;
                        }
                        // Otherwise, the DiggerProjectile's own update method handles tunneling.
                    }
                    // Allow explosion even if it surfaces after tunneling
                    if (proj.shouldExplode) {
                        this.handleProjectileExplosion(proj, terrainHeight);
                        projectilesToRemove.push(proj);
                        continue;
                    }
                    // If out of bounds and still active (finished tunneling or never hit terrain)
                    if (outOfBounds) {
                        projectilesToRemove.push(proj); // Just remove, no explosion
                        continue;
                    }
                    // Continue to next projectile if it's a Digger (either tunneling or just flying)
                    continue;
                }

                // Roller collision with tanks and explosion conditions
                if (proj instanceof RollerProjectile) {
                    // Check if roller hit a tank
                    let hitTank = false;
                    for (const tank of this.tanks) {
                        if (tank.isAlive()) {
                            const dist = Math.sqrt(
                                Math.pow(tank.x - proj.x, 2) +
                                Math.pow(tank.y - proj.y, 2)
                            );
                            if (dist < 15) {
                                hitTank = true;
                                break;
                            }
                        }
                    }
                    if (hitTank) {
                        this.handleProjectileExplosion(proj, terrainHeight);
                        projectilesToRemove.push(proj);
                        continue;
                    }

                    // Check if should explode (stuck, stopped, or in valley)
                    if (proj.shouldExplode) {
                        this.handleProjectileExplosion(proj, terrainHeight);
                        projectilesToRemove.push(proj);
                        continue;
                    }

                    // Rollers don't explode on normal terrain collision - they keep rolling
                    // Only check out of bounds if not handled above (e.g. if it didn't hit a tank or explode due to stuck state)
                    if (outOfBounds) {
                        this.handleProjectileExplosion(proj, terrainHeight);
                        projectilesToRemove.push(proj);
                        continue;
                    }

                    // Continue rolling
                    continue;
                }

                // Riot charge - special terrain destruction (already has continue, but to be sure)
                if (proj.type === 'riotcharge' && hitTerrain) {
                    this.handleRiotCharge(proj, terrainHeight);
                    projectilesToRemove.push(proj);
                    continue;
                }

                // Normal collision for all other projectiles (including those with contact triggers that hit terrain)
                if (hitTerrain || outOfBounds) {
                    this.handleProjectileExplosion(proj, terrainHeight);
                    projectilesToRemove.push(proj);
                }
            }

            // Remove inactive projectiles
            for (const proj of projectilesToRemove) {
                const index = this.projectiles.indexOf(proj);
                if (index > -1) {
                    this.projectiles.splice(index, 1);
                }
            }

            // Update main projectile reference
            this.projectile = this.projectiles.length > 0 ? this.projectiles[0] : null;
        } else {
            // No projectiles, ensure main reference is null
            this.projectile = null;
        }

        // Check for game over if all projectiles are done (only if a projectile was fired)
        if (this.projectileFiredThisTurn && this.projectiles.length === 0 && this.projectile === null && !this.turnCompletionScheduled) {
            this.turnCompletionScheduled = true;
            // Delay check to allow explosions to finish
            setTimeout(() => {
                const aliveTanks = this.tanks.filter(t => t.isAlive());
                if (aliveTanks.length === 1) {
                    const winnerIndex = this.tanks.findIndex(t => t.isAlive());
                    this.endRound(winnerIndex);
                } else if (aliveTanks.length === 0) {
                    this.endRound(-1);
                } else {
                    this.nextTurn();
                }
            }, GAME_CONFIG.TURN_DELAY);
        }

        // Update explosions
        this.explosions = this.explosions.filter(e => e.update(dt));

        // Update tank positions to match terrain
        if (this.terrain) {
            for (const tank of this.tanks) {
                if (tank.isAlive()) {
                    tank.y = this.terrain.getHeight(tank.x);
                }
            }
        }
    }

    private handleProjectileExplosion(proj: BaseProjectile, terrainHeight: number): void {
        if (!this.terrain) return;

        const explodeX = proj.x;
        const explodeY = Math.max(proj.y, terrainHeight);
        const explosionRadius = proj.getExplosionRadius();
        const baseDamage = proj.getDamage();

        // Create explosion
        const explosion = new Explosion(explodeX, explodeY, proj.type);
        this.explosions.push(explosion);

        // Handle napalm - create fire pools
        if (proj.type === 'napalm') {
            const pool = new NapalmPool(explodeX, explodeY, 50);
            this.napalmPools.push(pool);
            // Create additional smaller pools around impact
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2;
                const dist = 15 + Math.random() * 10;
                const poolX = explodeX + Math.cos(angle) * dist;
                const poolY = explodeY + Math.sin(angle) * dist;
                const smallPool = new NapalmPool(poolX, poolY, 30);
                this.napalmPools.push(smallPool);
            }
        }

        applyTerrainEffect(this.terrain, proj.type, explodeX, explodeY, explosionRadius);
        this.reportAIShotResult(explodeX, explodeY);

        // Check damage to tanks
        for (const tank of this.tanks) {
            if (!tank.isAlive()) continue;

            const dist = Math.sqrt(
                Math.pow(tank.x - explodeX, 2) +
                Math.pow(tank.y - explodeY, 2)
            );

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
            console.warn('Unable to determine firing tank for riot charge');
            return;
        }

        // Destroy wedge of dirt around tank
        const tankX = Math.floor(firingTank.x);
        const wedgeAngle = Math.PI / 3; // 60 degree wedge
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

    private isValidTankIndex(index: number): boolean {
        return index >= 0 && index < this.tanks.length && this.tanks[index] !== undefined;
    }

    private showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration: number = 3000): void {
        const container = document.getElementById('toast-container');
        if (!container) {
            console.warn('Toast container not found, falling back to console');
            console.log(`[${type.toUpperCase()}] ${message}`);
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        // Add icon based on type
        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        switch (type) {
            case 'success':
                icon.textContent = '✓';
                break;
            case 'error':
                icon.textContent = '✕';
                break;
            case 'warning':
                icon.textContent = '⚠';
                break;
            case 'info':
                icon.textContent = 'ℹ';
                break;
        }

        const messageSpan = document.createElement('span');
        messageSpan.className = 'toast-message';
        messageSpan.textContent = message;

        toast.appendChild(icon);
        toast.appendChild(messageSpan);
        container.appendChild(toast);

        // Remove toast after animation completes
        setTimeout(() => {
            toast.style.animation = 'toastFadeOut 0.3s ease-in';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    private endRound(winnerIndex: number): void {
        if (winnerIndex >= 0) {
            // Someone won, go to shop
            this.showScreen('shop');
        } else {
            // Draw, go to game over
            this.gameOver(-1);
        }
    }

    private gameOver(winnerIndex: number): void {
        const winnerText = document.getElementById('winner-text');
        if (!winnerText) {
            console.error('Winner text element not found');
            this.showScreen('gameover');
            return;
        }

        if (winnerIndex >= 0) {
            const winnerName = this.gameMode === '1player' && winnerIndex === 1
                ? 'Computer'
                : `Player ${winnerIndex + 1}`;
            winnerText.textContent = `${winnerName} wins!`;
        } else {
            winnerText.textContent = "It's a draw!";
        }
        this.showScreen('gameover');
    }

    private makeAIMove(): void {
        if (!this.isValidTankIndex(this.currentPlayerIndex) || !this.terrain) {
            console.error('Invalid tank index for AI move');
            return;
        }

        const aiTank = this.tanks[this.currentPlayerIndex];
        const enemies = this.tanks.filter((tank, index) => index !== this.currentPlayerIndex && tank.isAlive());
        if (enemies.length === 0) {
            return;
        }

        const defaultTarget = enemies[0];
        const profileId = this.aiAssignments.get(this.currentPlayerIndex) ?? this.aiProfileId;
        const profile = getAIProfile(profileId);
        const decision = profile.decide({
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
        const weaponToUse = desiredWeapon ?? 'normal';
        aiTank.setWeapon(weaponToUse);

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

        this.updateHUD();

        setTimeout(() => {
            this.fire();
        }, GAME_CONFIG.AI_SHOOT_DELAY);
    }

    private nextTurn(): void {
        if (this.tanks.length === 0) {
            console.error('No tanks available for next turn');
            return;
        }

        // Reset turn state
        this.projectileFiredThisTurn = false;
        this.turnCompletionScheduled = false;

        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.tanks.length;

        // Skip dead tanks
        let attempts = 0;
        const maxAttempts = this.tanks.length;
        while (this.isValidTankIndex(this.currentPlayerIndex) && !this.tanks[this.currentPlayerIndex].isAlive() && attempts < maxAttempts) {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.tanks.length;
            attempts++;
        }

        if (!this.isValidTankIndex(this.currentPlayerIndex)) {
            console.error('No alive tanks found for next turn');
            return;
        }

        this.updateHUD();

        // If AI turn, make it shoot after a delay
        if (this.tanks[this.currentPlayerIndex].isAI) {
            setTimeout(() => {
                this.makeAIMove();
            }, GAME_CONFIG.AI_THINK_DELAY);
        }
    }

    private render(): void {
        // Clear canvas
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Render terrain
        if (this.terrain) {
            this.terrain.render(this.ctx, this.canvas.height);
        }

        // Render tanks
        for (const tank of this.tanks) {
            if (tank.isAlive()) {
                tank.render(this.ctx, this.canvas.height);
            }
        }

        // Render all projectiles (including MIRV splits)
        for (const proj of this.projectiles) {
            if (proj.active) {
                proj.render(this.ctx, this.canvas.height);
            }
        }

        // Render napalm pools
        for (const pool of this.napalmPools) {
            pool.render(this.ctx, this.canvas.height);
        }

        // Render explosions
        for (const explosion of this.explosions) {
            explosion.render(this.ctx, this.canvas.height);
        }

        // Render wind indicator
        this.renderWindIndicator();
    }

    private renderWindIndicator(): void {
        const x = this.canvas.width / 2;
        const y = 30;

        // Wind label
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.strokeText('Wind', x, y);
        this.ctx.fillText('Wind', x, y);

        // Wind arrow
        const arrowLength = Math.abs(this.environment.windSpeed) * 15;
        const direction = this.environment.windSpeed > 0 ? 1 : -1;

        this.ctx.strokeStyle = 'white';
        this.ctx.fillStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + 10);
        this.ctx.lineTo(x + arrowLength * direction, y + 10);
        this.ctx.stroke();

        // Arrow head
        if (arrowLength > 5) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + arrowLength * direction, y + 10);
            this.ctx.lineTo(x + (arrowLength - 5) * direction, y + 5);
            this.ctx.lineTo(x + (arrowLength - 5) * direction, y + 15);
            this.ctx.closePath();
            this.ctx.fill();
        }

        // Wind speed text
        this.ctx.font = '12px Arial';
        this.ctx.strokeText(this.environment.windSpeed.toFixed(1), x, y + 30);
        this.ctx.fillText(this.environment.windSpeed.toFixed(1), x, y + 30);
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
            profile.onShotResult({
                shooter,
                target,
                impactX: x,
                impactY: y
            });
        }

        this.pendingAIShot = null;
    }

    private recordDamage(attackerIndex: number, victimIndex: number, amount: number): void {
        if (amount <= 0) {
            return;
        }
        if (!this.isValidTankIndex(attackerIndex) || !this.isValidTankIndex(victimIndex)) {
            return;
        }

        const attacker = this.tanks[attackerIndex];
        const victim = this.tanks[victimIndex];
        this.recentDamage.unshift({
            attackerName: attacker.name,
            victimName: victim.name,
            amount,
            timestamp: performance.now()
        });

        if (this.recentDamage.length > 10) {
            this.recentDamage.pop();
        }
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GameController();
    // Expose development helpers
    GameController.exposeServiceWorkerHelpers();
});
