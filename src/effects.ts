import { GAME_CONFIG } from './constants.js';
import { Terrain } from './terrain.js';

// Explosion particle system
export class Explosion {
    x: number;
    y: number;
    particles: Particle[];
    type: string;
    lifetime: number;
    age: number;

    constructor(x: number, y: number, type: string) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.particles = [];
        this.lifetime = type === 'nuke'
            ? GAME_CONFIG.EXPLOSION_LIFETIME_NUKE
            : GAME_CONFIG.EXPLOSION_LIFETIME;
        this.age = 0;
        this.createParticles();
    }

    private createParticles(): void {
        const count = this.type === 'nuke'
            ? GAME_CONFIG.EXPLOSION_PARTICLE_COUNT_NUKE
            : GAME_CONFIG.EXPLOSION_PARTICLE_COUNT;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * (GAME_CONFIG.EXPLOSION_PARTICLE_SPEED_MAX - GAME_CONFIG.EXPLOSION_PARTICLE_SPEED_MIN)
                + GAME_CONFIG.EXPLOSION_PARTICLE_SPEED_MIN;
            this.particles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0
            });
        }
    }

    update(dt: number): boolean {
        this.age += dt;
        const dtMultiplier = 60; // FPS normalization

        for (const particle of this.particles) {
            particle.x += particle.vx * dt * dtMultiplier;
            particle.y += particle.vy * dt * dtMultiplier;
            particle.vy -= GAME_CONFIG.EXPLOSION_PARTICLE_GRAVITY * dt * dtMultiplier;
            particle.life -= dt / this.lifetime;
        }

        return this.age < this.lifetime;
    }

    render(ctx: CanvasRenderingContext2D, canvasHeight: number): void {
        for (const particle of this.particles) {
            if (particle.life > 0) {
                ctx.fillStyle = this.getParticleColor(particle.life);
                ctx.beginPath();
                ctx.arc(particle.x, canvasHeight - particle.y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    private getParticleColor(life: number): string {
        const alpha = Math.max(0, life);
        switch (this.type) {
            case 'napalm':
                return `rgba(255, ${Math.floor(69 * life)}, 0, ${alpha})`;
            case 'nuke':
                return `rgba(255, 255, 0, ${alpha})`;
            case 'blackhole':
                return `rgba(128, 0, 128, ${alpha})`;
            default:
                return `rgba(255, 100, 0, ${alpha})`;
        }
    }
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
}

// Napalm Pool - spreading fire effect
export class NapalmPool {
    x: number;
    y: number;
    radius: number;
    maxRadius: number;
    lifetime: number;
    age: number;
    damagePerSecond: number;
    active: boolean;

    constructor(x: number, y: number, maxRadius: number = 50) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = maxRadius;
        this.lifetime = 5.0; // 5 seconds
        this.age = 0;
        this.damagePerSecond = 5;
        this.active = true;
    }

    update(dt: number, terrain: Terrain): boolean {
        this.age += dt;

        // Expand radius over time
        if (this.radius < this.maxRadius) {
            this.radius += (this.maxRadius / 2) * dt; // Expand over 2 seconds
        }

        // Spread to nearby areas (simplified - just expand)
        if (this.radius < this.maxRadius) {
            // Create small pools around edges
            const spreadChance = 0.1 * dt;
            if (Math.random() < spreadChance && this.radius > 10) {
                const angle = Math.random() * Math.PI * 2;
                const dist = this.radius * 0.8;
                const newX = this.x + Math.cos(angle) * dist;
                const newY = this.y + Math.sin(angle) * dist;
                // Could create new pools here, but for simplicity just expand
            }
        }

        return this.age < this.lifetime;
    }

    render(ctx: CanvasRenderingContext2D, canvasHeight: number): void {
        const alpha = 1.0 - (this.age / this.lifetime);
        const intensity = Math.sin(this.age * 5) * 0.3 + 0.7;

        // Draw fire pool with gradient
        const gradient = ctx.createRadialGradient(
            this.x, canvasHeight - this.y,
            0,
            this.x, canvasHeight - this.y,
            this.radius
        );
        gradient.addColorStop(0, `rgba(255, ${Math.floor(100 * intensity)}, 0, ${alpha * 0.8})`);
        gradient.addColorStop(0.5, `rgba(255, ${Math.floor(69 * intensity)}, 0, ${alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(255, 0, 0, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, canvasHeight - this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw fire particles
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * this.radius;
            const px = this.x + Math.cos(angle) * dist;
            const py = canvasHeight - this.y + Math.sin(angle) * dist;
            const particleLife = Math.random();
            ctx.fillStyle = `rgba(255, ${Math.floor(150 * particleLife)}, 0, ${alpha * particleLife})`;
            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    checkDamage(tankX: number, tankY: number): number {
        const dist = Math.sqrt(
            Math.pow(tankX - this.x, 2) + Math.pow(tankY - this.y, 2)
        );
        if (dist < this.radius) {
            return this.damagePerSecond * (1 - dist / this.radius);
        }
        return 0;
    }
}
