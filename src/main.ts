import { Terrain, Tank, Projectile, Explosion, GameEnvironment } from './game.js';
import { GAME_CONFIG, WEAPONS, SHOP_ITEMS, VALID_WEAPON_TYPES, VALID_SHOP_ITEM_TYPES } from './constants.js';

class GameController {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private terrain: Terrain | null = null;
    private tanks: Tank[] = [];
    private projectile: Projectile | null = null;
    private explosions: Explosion[] = [];
    private environment: GameEnvironment;
    private currentPlayerIndex: number = 0;
    private gameMode: '1player' | '2player' = '1player';
    private gameState: 'menu' | 'playing' | 'shop' | 'gameover' = 'menu';
    private playerMoney: number[] = [1000, 1000];
    private round: number = 1;
    private lastTime: number = 0;
    private animationId: number = 0;

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
            navigator.serviceWorker.register('./service-worker.js')
                .then(() => console.log('Service Worker registered'))
                .catch(err => console.error('Service Worker registration failed:', err));
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

            if (this.isValidTankIndex(this.currentPlayerIndex) && !this.tanks[this.currentPlayerIndex].isAI) {
                this.tanks[this.currentPlayerIndex].setPower(value);
            }
        });

        document.getElementById('btn-fire')?.addEventListener('click', () => {
            this.fire();
        });

        // Shop/menu buttons
        document.getElementById('btn-next-round')?.addEventListener('click', () => {
            this.nextRound();
        });

        document.getElementById('btn-menu')?.addEventListener('click', () => {
            this.showScreen('menu');
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
                            currentTank.setAngle(currentTank.angle + GAME_CONFIG.ANGLE_STEP);
                            this.updateAngleDisplay();
                            break;
                        case 'ArrowRight':
                            currentTank.setAngle(currentTank.angle - GAME_CONFIG.ANGLE_STEP);
                            this.updateAngleDisplay();
                            break;
                        case 'ArrowUp':
                            currentTank.setPower(currentTank.power + GAME_CONFIG.POWER_STEP);
                            this.updatePowerDisplay();
                            break;
                        case 'ArrowDown':
                            currentTank.setPower(currentTank.power - GAME_CONFIG.POWER_STEP);
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
        const tank1Y = this.terrain.getHeight(tank1X) + GAME_CONFIG.TANK_Y_OFFSET;
        this.tanks.push(new Tank(tank1X, tank1Y, '#0000FF', 'Player 1', false));

        const tank2X = this.canvas.width * GAME_CONFIG.TANK2_X_RATIO;
        const tank2Y = this.terrain.getHeight(tank2X) + GAME_CONFIG.TANK_Y_OFFSET;
        const isAI = this.gameMode === '1player';
        const tank2Name = isAI ? 'Computer' : 'Player 2';
        this.tanks.push(new Tank(tank2X, tank2Y, '#FF0000', tank2Name, isAI));

        this.projectile = null;
        this.explosions = [];
    }

    private fire(): void {
        if (this.projectile) return;

        if (!this.isValidTankIndex(this.currentPlayerIndex)) {
            console.error('Invalid tank index when firing');
            return;
        }

        const currentTank = this.tanks[this.currentPlayerIndex];
        const weaponSelect = document.getElementById('weapon') as HTMLSelectElement;
        if (!weaponSelect) {
            console.error('Weapon select element not found');
            return;
        }
        const weaponType = weaponSelect.value;

        // Validate weapon type
        if (!VALID_WEAPON_TYPES.includes(weaponType)) {
            console.error(`Invalid weapon type: ${weaponType}`);
            alert('Invalid weapon selected!');
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
            alert('Not enough money for this weapon!');
            return;
        }

        this.playerMoney[this.currentPlayerIndex] -= cost;
        this.updateHUD();

        this.projectile = new Projectile(
            currentTank.x,
            currentTank.y,
            currentTank.angle,
            currentTank.power,
            weaponType
        );
    }

    private nextRound(): void {
        this.round++;
        this.showScreen('game');

        // Ensure canvas dimensions are set
        requestAnimationFrame(() => {
            this.canvas.width = this.canvas.offsetWidth;
            this.canvas.height = this.canvas.offsetHeight;
            this.initializeLevel();
            this.updateHUD();
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
                document.getElementById('shop-screen')?.classList.add('active');
                this.gameState = 'shop';
                this.showShop();
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
            alert('Invalid item selected!');
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
            }
        }

        if (success) {
            alert(`Purchased ${shopItem.name}! Remaining: $${this.playerMoney[currentPlayerIndex]}`);
        } else {
            alert('Not enough money!');
        }
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
        // Update projectile
        if (this.projectile) {
            if (!this.terrain) {
                console.error('Terrain not initialized');
                return;
            }

            this.projectile.update(dt, this.environment.gravity, this.environment.windSpeed);

            // Check collision with terrain
            const terrainHeight = this.terrain.getHeight(this.projectile.x);
            if (this.projectile.y <= terrainHeight || this.projectile.x < 0 || this.projectile.x > this.canvas.width) {
                // Create explosion
                const explosion = new Explosion(this.projectile.x, this.projectile.y, this.projectile.type);
                this.explosions.push(explosion);

                // Damage terrain
                this.terrain.explode(this.projectile.x, this.projectile.y, this.projectile.getExplosionRadius());

                // Check damage to tanks
                for (const tank of this.tanks) {
                    const dist = Math.sqrt(
                        Math.pow(tank.x - this.projectile.x, 2) +
                        Math.pow(tank.y - this.projectile.y, 2)
                    );

                    if (dist < this.projectile.getExplosionRadius()) {
                        const damage = this.projectile.getDamage() * (1 - dist / this.projectile.getExplosionRadius());
                        tank.takeDamage(damage);
                    }
                }

                this.projectile = null;

                // Check for game over
                const aliveTanks = this.tanks.filter(t => t.isAlive());
                if (aliveTanks.length === 1) {
                    setTimeout(() => {
                        const winnerIndex = this.tanks.findIndex(t => t.isAlive());
                        this.endRound(winnerIndex);
                    }, GAME_CONFIG.EXPLOSION_DELAY);
                } else if (aliveTanks.length === 0) {
                    setTimeout(() => {
                        this.endRound(-1);
                    }, GAME_CONFIG.EXPLOSION_DELAY);
                } else {
                    // Next player's turn
                    setTimeout(() => {
                        this.nextTurn();
                    }, GAME_CONFIG.TURN_DELAY);
                }
            }
        }

        // Update explosions
        this.explosions = this.explosions.filter(e => e.update(dt));

        // Update tank positions to match terrain
        if (this.terrain) {
            for (const tank of this.tanks) {
                if (tank.isAlive()) {
                    tank.y = this.terrain.getHeight(tank.x) + GAME_CONFIG.TANK_Y_OFFSET;
                }
            }
        }
    }

    private nextTurn(): void {
        if (this.tanks.length === 0) {
            console.error('No tanks available for next turn');
            return;
        }

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

    private makeAIMove(): void {
        if (!this.isValidTankIndex(this.currentPlayerIndex)) {
            console.error('Invalid tank index for AI move');
            return;
        }

        const aiTank = this.tanks[this.currentPlayerIndex];
        const targetTank = this.tanks.find(t => !t.isAI && t.isAlive());

        if (targetTank) {
            const decision = aiTank.makeAIDecision(targetTank.x, targetTank.y);
            aiTank.setAngle(decision.angle);
            aiTank.setPower(decision.power);
            this.updateHUD();

            setTimeout(() => {
                this.fire();
            }, GAME_CONFIG.AI_SHOOT_DELAY);
        }
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

        // Render projectile
        if (this.projectile) {
            this.projectile.render(this.ctx, this.canvas.height);
        }

        // Render explosions
        for (const explosion of this.explosions) {
            explosion.render(this.ctx, this.canvas.height);
        }

        // Render wind indicator
        this.renderWindIndicator();
    }

    private isValidTankIndex(index: number): boolean {
        return index >= 0 && index < this.tanks.length && this.tanks[index] !== undefined;
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
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GameController();
});
