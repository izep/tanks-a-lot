import { GAME_CONFIG, WEAPONS } from './constants.js';

// Game physics and environment
export class GameEnvironment {
    gravity: number;
    windSpeed: number;

    constructor() {
        this.gravity = GAME_CONFIG.GRAVITY;
        this.windSpeed = 0;
        this.generateWind();
    }

    generateWind(): void {
        // Random wind between WIND_MIN and WIND_MAX
        this.windSpeed = (Math.random() - 0.5) * GAME_CONFIG.WIND_RANGE;
    }

    setGravity(gravity: number): void {
        this.gravity = gravity;
    }
}

// Terrain generation and manipulation
export class Terrain {
    private heights: number[];
    private width: number;
    private maxHeight: number;

    constructor(width: number, maxHeight: number) {
        this.width = width;
        this.maxHeight = maxHeight;
        this.heights = new Array(width).fill(0);
        this.generate();
    }

    private generate(): void {
        // Generate random terrain using midpoint displacement
        const segments = GAME_CONFIG.TERRAIN_SEGMENTS;
        const segmentWidth = this.width / segments;

        // Set random heights at segment boundaries
        for (let i = 0; i <= segments; i++) {
            const x = Math.floor(i * segmentWidth);
            this.heights[x] = Math.random() * this.maxHeight * GAME_CONFIG.TERRAIN_HEIGHT_MAX_RATIO
                + this.maxHeight * GAME_CONFIG.TERRAIN_HEIGHT_MIN_RATIO;
        }

        // Interpolate between points
        for (let i = 0; i < segments; i++) {
            const x1 = Math.floor(i * segmentWidth);
            const x2 = Math.floor((i + 1) * segmentWidth);
            const h1 = this.heights[x1];
            const h2 = this.heights[x2];

            for (let x = x1; x < x2; x++) {
                const t = (x - x1) / (x2 - x1);
                // Add some randomness
                const noise = (Math.random() - 0.5) * GAME_CONFIG.TERRAIN_NOISE_AMPLITUDE;
                this.heights[x] = h1 + (h2 - h1) * t + noise;
            }
        }

        // Smooth the terrain
        this.smooth();
    }

    private smooth(): void {
        const smoothed = [...this.heights];
        for (let i = 1; i < this.width - 1; i++) {
            smoothed[i] = (this.heights[i - 1] + this.heights[i] + this.heights[i + 1]) / 3;
        }
        this.heights = smoothed;
    }

    getHeight(x: number): number {
        if (!Number.isFinite(x)) {
            console.warn('Invalid x coordinate for terrain height:', x);
            return 0;
        }
        const ix = Math.floor(x);
        if (ix < 0 || ix >= this.width) {
            return 0;
        }
        return this.heights[ix] ?? 0;
    }

    // Explosion creates a crater and makes terrain settle like viscous sand
    explode(x: number, y: number, radius: number): void {
        const ix = Math.floor(x);

        // Create crater
        for (let i = Math.max(0, ix - radius); i < Math.min(this.width, ix + radius); i++) {
            const dist = Math.abs(i - ix);
            const effect = Math.max(0, 1 - dist / radius);
            const craterDepth = radius * effect * 0.8;

            if (this.heights[i] > y - radius) {
                this.heights[i] -= craterDepth;
            }
        }

        // Settle terrain like viscous sand (no overhangs)
        this.settle();
    }

    // Make terrain settle to remove overhangs
    private settle(): void {
        const maxSlope = GAME_CONFIG.TERRAIN_MAX_SLOPE;
        const maxIterations = GAME_CONFIG.TERRAIN_SETTLE_ITERATIONS;

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            let settled = true;
            for (let i = 0; i < this.width - 1; i++) {
                const diff = this.heights[i] - this.heights[i + 1];
                if (Math.abs(diff) > maxSlope) {
                    const transfer = (Math.abs(diff) - maxSlope) / 2;
                    if (diff > 0) {
                        this.heights[i] -= transfer;
                        this.heights[i + 1] += transfer;
                    } else {
                        this.heights[i] += transfer;
                        this.heights[i + 1] -= transfer;
                    }
                    settled = false;
                }
            }
            if (settled) break;
        }
    }

    render(ctx: CanvasRenderingContext2D, canvasHeight: number): void {
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(0, canvasHeight);

        for (let x = 0; x < this.width; x++) {
            ctx.lineTo(x, canvasHeight - this.heights[x]);
        }

        ctx.lineTo(this.width, canvasHeight);
        ctx.closePath();
        ctx.fill();

        // Draw grass on top
        ctx.strokeStyle = '#228B22';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = 0; x < this.width; x++) {
            if (x === 0) {
                ctx.moveTo(x, canvasHeight - this.heights[x]);
            } else {
                ctx.lineTo(x, canvasHeight - this.heights[x]);
            }
        }
        ctx.stroke();
    }

    getWidth(): number {
        return this.width;
    }
}

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

    // AI makes a decision
    makeAIDecision(targetX: number, targetY: number): { angle: number, power: number } {
        // Simple AI: aim towards target with some randomness
        const dx = targetX - this.x;
        const dy = this.y - targetY;

        // Calculate rough angle (inverted because canvas Y is inverted)
        let angle = Math.atan2(-dy, dx) * 180 / Math.PI;
        angle = Math.max(0, Math.min(180, angle));

        // Add some randomness to make it interesting
        angle += (Math.random() - 0.5) * 30;
        angle = Math.max(0, Math.min(180, angle));

        // Calculate rough power based on distance
        const distance = Math.sqrt(dx * dx + dy * dy);
        let power = Math.min(100, distance / 10);
        power += (Math.random() - 0.5) * 20;
        power = Math.max(10, Math.min(100, power));

        return { angle, power };
    }

    render(ctx: CanvasRenderingContext2D, canvasHeight: number): void {
        // Draw tank body
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - 10, canvasHeight - this.y - 10, 20, 10);

        // Draw turret
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, canvasHeight - this.y - 5, 5, 0, Math.PI * 2);
        ctx.fill();

        // Draw barrel
        const barrelLength = 15;
        const angleRad = (this.angle) * Math.PI / 180;
        const endX = this.x + Math.cos(angleRad) * barrelLength;
        const endY = canvasHeight - this.y - Math.sin(angleRad) * barrelLength;

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.x, canvasHeight - this.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Draw shield if active
        if (this.shield > 0) {
            ctx.strokeStyle = 'cyan';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, canvasHeight - this.y, 18, 0, Math.PI * 2);
            ctx.stroke();

            // Shield strength indicator
            ctx.strokeStyle = `rgba(0, 255, 255, ${this.shield / this.maxShield})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, canvasHeight - this.y, 18, 0, Math.PI * 2 * (this.shield / this.maxShield));
            ctx.stroke();
        }

        // Draw health bar
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - 15, canvasHeight - this.y - 25, 30, 4);
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x - 15, canvasHeight - this.y - 25, 30 * (this.health / this.maxHealth), 4);

        // Draw name
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.strokeText(this.name, this.x, canvasHeight - this.y - 28);
        ctx.fillText(this.name, this.x, canvasHeight - this.y - 28);
    }
}

// Projectile class
export class Projectile {
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: string;
    active: boolean;
    trail: Array<{x: number, y: number}>;

    constructor(x: number, y: number, angle: number, power: number, type: string = 'normal') {
        this.x = x;
        this.y = y;
        const angleRad = angle * Math.PI / 180;
        const speed = power * GAME_CONFIG.PROJECTILE_SPEED_MULTIPLIER;
        this.vx = Math.cos(angleRad) * speed;
        this.vy = Math.sin(angleRad) * speed;
        this.type = type;
        this.active = true;
        this.trail = [];
    }

    update(dt: number, gravity: number, windSpeed: number): void {
        // Store trail for visual effect
        if (this.trail.length >= GAME_CONFIG.PROJECTILE_TRAIL_MAX_LENGTH) {
            this.trail.shift();
        }
        this.trail.push({x: this.x, y: this.y});

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy -= gravity * dt; // Gravity

        // Wind affects projectile
        this.vx += windSpeed * dt * GAME_CONFIG.WIND_EFFECT_MULTIPLIER;
    }

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

        // Special effects for certain weapons
        if (this.type === 'nuke') {
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, canvasHeight - this.y, 6, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    private getColor(): string {
        switch (this.type) {
            case 'napalm': return '#FF4500';
            case 'nuke': return '#00FF00';
            case 'blackhole': return '#000000';
            case 'mirv': return '#FF00FF'; // Multiple Independent Reentry Vehicle
            case 'laser': return '#00FFFF';
            case 'funky': return '#FFD700'; // Bouncing bomb
            case 'digger': return '#8B4513'; // Tunneling weapon
            default: return '#333333';
        }
    }

    getExplosionRadius(): number {
        const weapon = WEAPONS.find(w => w.value === this.type);
        if (weapon) {
            return weapon.radius;
        }
        // Fallback to default
        return 30;
    }

    getDamage(): number {
        const weapon = WEAPONS.find(w => w.value === this.type);
        if (weapon) {
            return weapon.damage;
        }
        // Fallback to default
        return 30;
    }
}

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
