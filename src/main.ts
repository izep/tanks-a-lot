import { Terrain, Tank, Projectile, Explosion, GameEnvironment } from './game.js';

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
        this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
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
            const value = parseInt((e.target as HTMLInputElement).value);
            document.getElementById('angle-value')!.textContent = value.toString();
            if (!this.tanks[this.currentPlayerIndex].isAI) {
                this.tanks[this.currentPlayerIndex].setAngle(value);
            }
        });

        document.getElementById('power')?.addEventListener('input', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value);
            document.getElementById('power-value')!.textContent = value.toString();
            if (!this.tanks[this.currentPlayerIndex].isAI) {
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
                this.buyItem(item!);
            });
        });

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (this.gameState === 'playing' && !this.projectile) {
                const currentTank = this.tanks[this.currentPlayerIndex];
                if (!currentTank.isAI) {
                    switch (e.key) {
                        case 'ArrowLeft':
                            currentTank.setAngle(currentTank.angle + 5);
                            this.updateAngleDisplay();
                            break;
                        case 'ArrowRight':
                            currentTank.setAngle(currentTank.angle - 5);
                            this.updateAngleDisplay();
                            break;
                        case 'ArrowUp':
                            currentTank.setPower(currentTank.power + 5);
                            this.updatePowerDisplay();
                            break;
                        case 'ArrowDown':
                            currentTank.setPower(currentTank.power - 5);
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
        const angle = this.tanks[this.currentPlayerIndex].angle;
        document.getElementById('angle-value')!.textContent = Math.round(angle).toString();
        (document.getElementById('angle') as HTMLInputElement).value = Math.round(angle).toString();
    }

    private updatePowerDisplay(): void {
        const power = this.tanks[this.currentPlayerIndex].power;
        document.getElementById('power-value')!.textContent = Math.round(power).toString();
        (document.getElementById('power') as HTMLInputElement).value = Math.round(power).toString();
    }

    private startGame(mode: '1player' | '2player'): void {
        this.gameMode = mode;
        this.gameState = 'playing';
        this.round = 1;
        this.playerMoney = [1000, 1000];
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
        this.terrain = new Terrain(this.canvas.width, this.canvas.height * 0.6);
        
        // Generate new wind for this round
        this.environment.generateWind();
        
        // Create tanks
        this.tanks = [];
        const tank1X = this.canvas.width * 0.2;
        const tank1Y = this.terrain.getHeight(tank1X) + 10;
        this.tanks.push(new Tank(tank1X, tank1Y, '#0000FF', 'Player 1', false));
        
        const tank2X = this.canvas.width * 0.8;
        const tank2Y = this.terrain.getHeight(tank2X) + 10;
        const isAI = this.gameMode === '1player';
        const tank2Name = isAI ? 'Computer' : 'Player 2';
        this.tanks.push(new Tank(tank2X, tank2Y, '#FF0000', tank2Name, isAI));
        
        this.projectile = null;
        this.explosions = [];
    }

    private fire(): void {
        if (this.projectile) return;
        
        const currentTank = this.tanks[this.currentPlayerIndex];
        const weaponSelect = document.getElementById('weapon') as HTMLSelectElement;
        const weaponType = weaponSelect.value;
        
        // Check if player can afford the weapon
        const cost = this.getWeaponCost(weaponType);
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

    private getWeaponCost(weaponType: string): number {
        switch (weaponType) {
            case 'napalm': return 100;
            case 'mirv': return 200;
            case 'funky': return 150;
            case 'laser': return 300;
            case 'digger': return 250;
            case 'nuke': return 500;
            case 'blackhole': return 1000;
            default: return 0;
        }
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
        const results = document.getElementById('round-results')!;
        
        if (winner >= 0) {
            results.textContent = `Round ${this.round} - ${this.tanks[winner].name} wins! +$500`;
            this.playerMoney[winner] += 500;
        }
    }
    
    private buyItem(item: string): void {
        const currentPlayerIndex = this.tanks.findIndex(t => t.isAlive());
        if (currentPlayerIndex < 0) return;
        
        let cost = 0;
        let success = false;
        
        switch (item) {
            case 'shield':
                cost = 200;
                if (this.playerMoney[currentPlayerIndex] >= cost) {
                    this.tanks[currentPlayerIndex].addShield(50);
                    this.playerMoney[currentPlayerIndex] -= cost;
                    success = true;
                }
                break;
            case 'repair':
                cost = 150;
                if (this.playerMoney[currentPlayerIndex] >= cost) {
                    this.tanks[currentPlayerIndex].repair(30);
                    this.playerMoney[currentPlayerIndex] -= cost;
                    success = true;
                }
                break;
        }
        
        if (success) {
            alert(`Purchased ${item}! Remaining: $${this.playerMoney[currentPlayerIndex]}`);
        } else {
            alert('Not enough money!');
        }
    }

    private updateHUD(): void {
        const playerName = this.gameMode === '1player' && this.currentPlayerIndex === 1 
            ? 'Computer' 
            : `Player ${this.currentPlayerIndex + 1}`;
        document.getElementById('current-player')!.textContent = playerName;
        document.getElementById('money')!.textContent = `Money: $${this.playerMoney[this.currentPlayerIndex]}`;
        
        this.updateAngleDisplay();
        this.updatePowerDisplay();
    }

    private gameLoop(timestamp: number): void {
        if (this.gameState !== 'playing') return;
        
        const dt = this.lastTime ? Math.min((timestamp - this.lastTime) / 1000, 0.1) : 0.016;
        this.lastTime = timestamp;
        
        this.update(dt);
        this.render();
        
        this.animationId = requestAnimationFrame((t) => this.gameLoop(t));
    }

    private update(dt: number): void {
        // Update projectile
        if (this.projectile) {
            this.projectile.update(dt, this.environment.gravity, this.environment.windSpeed);
            
            // Check collision with terrain
            const terrainHeight = this.terrain!.getHeight(this.projectile.x);
            if (this.projectile.y <= terrainHeight || this.projectile.x < 0 || this.projectile.x > this.canvas.width) {
                // Create explosion
                const explosion = new Explosion(this.projectile.x, this.projectile.y, this.projectile.type);
                this.explosions.push(explosion);
                
                // Damage terrain
                this.terrain!.explode(this.projectile.x, this.projectile.y, this.projectile.getExplosionRadius());
                
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
                    }, 2000);
                } else if (aliveTanks.length === 0) {
                    setTimeout(() => {
                        this.endRound(-1);
                    }, 2000);
                } else {
                    // Next player's turn
                    setTimeout(() => {
                        this.nextTurn();
                    }, 1000);
                }
            }
        }
        
        // Update explosions
        this.explosions = this.explosions.filter(e => e.update(dt));
        
        // Update tank positions to match terrain
        for (const tank of this.tanks) {
            if (tank.isAlive()) {
                tank.y = this.terrain!.getHeight(tank.x) + 10;
            }
        }
    }

    private nextTurn(): void {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.tanks.length;
        
        // Skip dead tanks
        while (!this.tanks[this.currentPlayerIndex].isAlive()) {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.tanks.length;
        }
        
        this.updateHUD();
        
        // If AI turn, make it shoot after a delay
        if (this.tanks[this.currentPlayerIndex].isAI) {
            setTimeout(() => {
                this.makeAIMove();
            }, 1500);
        }
    }

    private makeAIMove(): void {
        const aiTank = this.tanks[this.currentPlayerIndex];
        const targetTank = this.tanks.find(t => !t.isAI && t.isAlive());
        
        if (targetTank) {
            const decision = aiTank.makeAIDecision(targetTank.x, targetTank.y);
            aiTank.setAngle(decision.angle);
            aiTank.setPower(decision.power);
            this.updateHUD();
            
            setTimeout(() => {
                this.fire();
            }, 500);
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
        const winnerText = document.getElementById('winner-text')!;
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
