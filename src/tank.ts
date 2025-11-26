import { GAME_CONFIG } from './constants.js';

// Tank class
export class Tank {
    x: number;
    y: number;
    angle: number;
    power: number;
    health: number;
    maxHealth: number;
    shield: number;
    maxShield: number;
    color: string;
    isAI: boolean;
    name: string;
    currentWeapon: string;
    animationTime: number;
    contactTriggers: number;
    useContactTrigger: boolean;

    constructor(x: number, y: number, color: string, name: string = 'Player', isAI: boolean = false) {
        this.x = x;
        this.y = y;
        this.angle = 45;
        this.power = 50;
        this.health = GAME_CONFIG.INITIAL_HEALTH;
        this.maxHealth = GAME_CONFIG.MAX_HEALTH;
        this.shield = 0;
        this.maxShield = GAME_CONFIG.MAX_SHIELD;
        this.color = color;
        this.isAI = isAI;
        this.name = name;
        this.currentWeapon = 'normal';
        this.animationTime = 0;
        this.contactTriggers = 0;
        this.useContactTrigger = false;
    }

    updateAnimation(dt: number): void {
        this.animationTime += dt;
    }

    setWeapon(weapon: string): void {
        this.currentWeapon = weapon;
    }

    setPosition(x: number, y: number): void {
        this.x = x;
        this.y = y;
    }

    setAngle(angle: number): void {
        this.angle = Math.max(GAME_CONFIG.ANGLE_MIN, Math.min(GAME_CONFIG.ANGLE_MAX, angle));
    }

    setPower(power: number): void {
        this.power = Math.max(GAME_CONFIG.POWER_MIN, Math.min(GAME_CONFIG.POWER_MAX, power));
    }

    takeDamage(damage: number): void {
        // Shield absorbs damage first
        if (this.shield > 0) {
            const shieldDamage = Math.min(this.shield, damage);
            this.shield -= shieldDamage;
            damage -= shieldDamage;
        }
        this.health = Math.max(0, this.health - damage);
    }

    addShield(amount: number): void {
        this.shield = Math.min(this.maxShield, this.shield + amount);
    }

    repair(amount: number): void {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    isAlive(): boolean {
        return this.health > 0;
    }

    /* c8 ignore start */
    render(ctx: CanvasRenderingContext2D, canvasHeight: number): void {
        const screenY = canvasHeight - this.y;
        const weaponConfig = this.getWeaponConfig();

        // Idle animation - slight bounce
        const bounce = Math.sin(this.animationTime * 2) * 0.5;
        const tankY = screenY + bounce;

        // Draw tank tracks (base)
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - 14, tankY - 2, 28, 4);

        // Draw tank body with gradient effect
        const bodyGradient = ctx.createLinearGradient(this.x - 12, tankY - 12, this.x + 12, tankY);
        bodyGradient.addColorStop(0, this.color);
        bodyGradient.addColorStop(0.5, this.lightenColor(this.color, 20));
        bodyGradient.addColorStop(1, this.color);
        ctx.fillStyle = bodyGradient;
        ctx.fillRect(this.x - 12, tankY - 12, 24, 12);

        // Draw body outline
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - 12, tankY - 12, 24, 12);

        // Draw turret with weapon-specific styling
        const turretRadius = weaponConfig.turretSize;
        const turretGradient = ctx.createRadialGradient(this.x, tankY - 5, 0, this.x, tankY - 5, turretRadius);
        turretGradient.addColorStop(0, this.lightenColor(this.color, 30));
        turretGradient.addColorStop(1, this.color);
        ctx.fillStyle = turretGradient;
        ctx.beginPath();
        ctx.arc(this.x, tankY - 5, turretRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw barrel with weapon-specific styling
        const barrelLength = weaponConfig.barrelLength;
        const barrelWidth = weaponConfig.barrelWidth;
        const angleRad = (this.angle) * Math.PI / 180;
        const endX = this.x + Math.cos(angleRad) * barrelLength;
        const endY = tankY - Math.sin(angleRad) * barrelLength;

        // Barrel shadow/outline
        ctx.strokeStyle = '#000';
        ctx.lineWidth = barrelWidth + 2;
        ctx.beginPath();
        ctx.moveTo(this.x, tankY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Barrel with weapon-specific color
        ctx.strokeStyle = weaponConfig.barrelColor;
        ctx.lineWidth = barrelWidth;
        ctx.beginPath();
        ctx.moveTo(this.x, tankY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Weapon-specific barrel tip
        if (weaponConfig.barrelTip) {
            ctx.fillStyle = weaponConfig.barrelTip;
            ctx.beginPath();
            ctx.arc(endX, endY, barrelWidth / 2 + 1, 0, Math.PI * 2);
            ctx.fill();
        }

        // Weapon-specific visual effects
        this.renderWeaponEffects(ctx, tankY);

        // Draw shield if active
        if (this.shield > 0) {
            const shieldAlpha = 0.3 + (this.shield / this.maxShield) * 0.4;
            ctx.strokeStyle = `rgba(0, 255, 255, ${shieldAlpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, tankY, 20, 0, Math.PI * 2);
            ctx.stroke();

            // Animated shield particles
            const particleCount = 8;
            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2 + this.animationTime * 2;
                const px = this.x + Math.cos(angle) * 20;
                const py = tankY + Math.sin(angle) * 20;
                ctx.fillStyle = `rgba(0, 255, 255, ${shieldAlpha})`;
                ctx.beginPath();
                ctx.arc(px, py, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw health bar with better styling
        const barWidth = 30;
        const barHeight = 5;
        const barX = this.x - barWidth / 2;
        const barY = tankY - 28;

        // Health bar background
        ctx.fillStyle = '#333';
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
        ctx.fillStyle = 'red';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health bar fill
        const healthPercent = this.health / this.maxHealth;
        const healthColor = healthPercent > 0.6 ? '#0f0' : healthPercent > 0.3 ? '#ff0' : '#f00';
        ctx.fillStyle = healthColor;
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

        // Draw name with better styling
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.strokeText(this.name, this.x, barY - 5);
        ctx.fillText(this.name, this.x, barY - 5);
    }

    private renderWeaponEffects(ctx: CanvasRenderingContext2D, tankY: number): void {
        switch (this.currentWeapon) {
            case 'laser':
                // Laser weapon - glowing energy effect
                const laserGlow = Math.sin(this.animationTime * 5) * 0.3 + 0.7;
                ctx.fillStyle = `rgba(0, 255, 255, ${laserGlow * 0.5})`;
                ctx.beginPath();
                ctx.arc(this.x, tankY - 5, 8, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'nuke':
                // Nuke weapon - radioactive symbol
                ctx.strokeStyle = '#ff0';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.x, tankY - 5, 6, 0, Math.PI * 2);
                ctx.stroke();
                // Radioactive symbol lines
                for (let i = 0; i < 3; i++) {
                    const angle = (i / 3) * Math.PI * 2;
                    const x1 = this.x + Math.cos(angle) * 6;
                    const y1 = tankY - 5 + Math.sin(angle) * 6;
                    const x2 = this.x + Math.cos(angle) * 10;
                    const y2 = tankY - 5 + Math.sin(angle) * 10;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
                break;
            case 'napalm':
                // Napalm weapon - fire effect
                const fireIntensity = Math.sin(this.animationTime * 4) * 0.3 + 0.7;
                ctx.fillStyle = `rgba(255, ${Math.floor(100 * fireIntensity)}, 0, ${fireIntensity * 0.6})`;
                ctx.beginPath();
                ctx.arc(this.x, tankY - 5, 7, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'blackhole':
                // Black hole weapon - swirling effect
                ctx.strokeStyle = `rgba(128, 0, 128, 0.6)`;
                ctx.lineWidth = 2;
                for (let i = 0; i < 3; i++) {
                    const angle = this.animationTime * 2 + (i / 3) * Math.PI * 2;
                    const radius = 5 + Math.sin(this.animationTime * 3 + i) * 2;
                    const x = this.x + Math.cos(angle) * radius;
                    const y = tankY - 5 + Math.sin(angle) * radius;
                    ctx.beginPath();
                    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            case 'mirv':
                // MIRV weapon - multiple warhead indicator
                for (let i = 0; i < 3; i++) {
                    const angle = (i / 3) * Math.PI * 2;
                    const x = this.x + Math.cos(angle) * 6;
                    const y = tankY - 5 + Math.sin(angle) * 6;
                    ctx.fillStyle = '#ff00ff';
                    ctx.beginPath();
                    ctx.arc(x, y, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            case 'digger':
                // Digger weapon - drill effect
                const drillRotation = this.animationTime * 10;
                ctx.strokeStyle = '#8B4513';
                ctx.lineWidth = 2;
                for (let i = 0; i < 4; i++) {
                    const angle = drillRotation + (i / 4) * Math.PI * 2;
                    const x1 = this.x + Math.cos(angle) * 3;
                    const y1 = tankY - 5 + Math.sin(angle) * 3;
                    const x2 = this.x + Math.cos(angle) * 7;
                    const y2 = tankY - 5 + Math.sin(angle) * 7;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }
                break;
            case 'funky':
                // Funky bomb - bouncing effect
                const bounce = Math.sin(this.animationTime * 6) * 2;
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(this.x, tankY - 5 + bounce, 4, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    }
    /* c8 ignore stop */

    public getWeaponConfig(): { turretSize: number, barrelLength: number, barrelWidth: number, barrelColor: string, barrelTip: string | null } {
        switch (this.currentWeapon) {
            case 'laser':
                return { turretSize: 6, barrelLength: 20, barrelWidth: 3, barrelColor: '#00FFFF', barrelTip: '#00FFFF' };
            case 'nuke':
                return { turretSize: 8, barrelLength: 18, barrelWidth: 5, barrelColor: '#FFD700', barrelTip: '#FF0' };
            case 'napalm':
                return { turretSize: 6, barrelLength: 16, barrelWidth: 4, barrelColor: '#FF4500', barrelTip: '#FF4500' };
            case 'blackhole':
                return { turretSize: 7, barrelLength: 17, barrelWidth: 4, barrelColor: '#800080', barrelTip: '#000' };
            case 'mirv':
                return { turretSize: 7, barrelLength: 19, barrelWidth: 4, barrelColor: '#FF00FF', barrelTip: '#FF00FF' };
            case 'digger':
                return { turretSize: 6, barrelLength: 15, barrelWidth: 5, barrelColor: '#8B4513', barrelTip: '#654321' };
            case 'funky':
                return { turretSize: 6, barrelLength: 16, barrelWidth: 4, barrelColor: '#FFD700', barrelTip: '#FFD700' };
            default: // normal
                return { turretSize: 5, barrelLength: 15, barrelWidth: 3, barrelColor: '#333', barrelTip: null };
        }
    }

    private lightenColor(color: string, percent: number): string {
        // Simple color lightening for gradients
        if (color.startsWith('#')) {
            const num = parseInt(color.replace('#', ''), 16);
            const r = Math.min(255, ((num >> 16) & 0xFF) + percent);
            const g = Math.min(255, ((num >> 8) & 0xFF) + percent);
            const b = Math.min(255, (num & 0xFF) + percent);
            return `rgb(${r}, ${g}, ${b})`;
        }
        return color;
    }
}
