import { GAME_CONFIG, WEAPONS } from '../constants.js';
import { Terrain } from '../terrain.js';

export abstract class BaseProjectile {
    x: number;
    y: number;
    vx: number;
    vy: number;
        type: string;
        active: boolean;
        trail: Array<{x: number, y: number}>;
        useContactTrigger: boolean;
    
        constructor(x: number, y: number, angle: number, power: number, type: string, useContactTrigger: boolean = false) {
            this.x = x;
            this.y = y;
            const angleRad = angle * Math.PI / 180;
            const speed = power * GAME_CONFIG.PROJECTILE_SPEED_MULTIPLIER;
            this.vx = Math.cos(angleRad) * speed;
            this.vy = Math.sin(angleRad) * speed;
            this.type = type;
            this.active = true;
            this.trail = [];
            this.useContactTrigger = useContactTrigger;
        }

    update(dt: number, gravity: number, windSpeed: number, terrain?: Terrain): void {
        // Store trail for visual effect
        if (this.trail.length >= GAME_CONFIG.PROJECTILE_TRAIL_MAX_LENGTH) {
            this.trail.shift();
        }
        this.trail.push({x: this.x, y: this.y});

        // Apply physics
        this.vy -= gravity * dt; // Gravity
        this.vx += windSpeed * dt * GAME_CONFIG.WIND_EFFECT_MULTIPLIER;

        // Apply position updates
        const animationDt = dt * GAME_CONFIG.PROJECTILE_ANIMATION_SPEED_MULTIPLIER;
        this.x += this.vx * animationDt;
        this.y += this.vy * animationDt;
    }

    /* c8 ignore start */
    render(ctx: CanvasRenderingContext2D, canvasHeight: number): void {
        // Draw trail
        ctx.strokeStyle = this.getColor();
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        for (let i = 0; i < this.trail.length - 1; i++) {
            const alpha = i / this.trail.length;
            ctx.globalAlpha = alpha * 0.5;
            if (i === 0) {
                ctx.moveTo(this.trail[i].x, canvasHeight - this.trail[i].y);
            } else {
                ctx.lineTo(this.trail[i].x, canvasHeight - this.trail[i].y);
            }
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Draw projectile
        ctx.fillStyle = this.getColor();
        ctx.beginPath();
        ctx.arc(this.x, canvasHeight - this.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    /* c8 ignore stop */

    getColor(): string {
        const weapon = WEAPONS.find(w => w.value === this.type);
        // Default colors mapping
        switch (this.type) {
            case 'napalm': return '#FF4500';
            case 'nuke': return '#00FF00';
            case 'blackhole': return '#000000';
            case 'mirv': return '#FF00FF';
            case 'laser': return '#00FFFF';
            case 'funky': return '#FFD700';
            case 'digger': return '#8B4513';
            case 'babydigger': return '#A0522D';
            case 'roller': return '#654321';
            case 'babyroller': return '#8B7355';
            case 'dirtclod': return '#8B4513';
            case 'dirtball': return '#654321';
            case 'riotcharge': return '#FFA500';
            case 'tracer': return '#FFFF00';
            default: return '#333333';
        }
    }

    getExplosionRadius(): number {
        const weapon = WEAPONS.find(w => w.value === this.type);
        return weapon ? weapon.radius : 30;
    }

    getDamage(): number {
        const weapon = WEAPONS.find(w => w.value === this.type);
        return weapon ? weapon.damage : 30;
    }
}
