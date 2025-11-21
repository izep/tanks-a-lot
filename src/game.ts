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
        const segments = 8;
        const segmentWidth = this.width / segments;
        
        // Set random heights at segment boundaries
        for (let i = 0; i <= segments; i++) {
            const x = Math.floor(i * segmentWidth);
            this.heights[x] = Math.random() * this.maxHeight * 0.6 + this.maxHeight * 0.2;
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
                const noise = (Math.random() - 0.5) * 20;
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
        const ix = Math.floor(x);
        if (ix < 0 || ix >= this.width) return 0;
        return this.heights[ix];
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
        const maxSlope = 3; // Maximum height difference between adjacent pixels
        let settled = false;
        
        while (!settled) {
            settled = true;
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
    color: string;
    isAI: boolean;

    constructor(x: number, y: number, color: string, isAI: boolean = false) {
        this.x = x;
        this.y = y;
        this.angle = 45;
        this.power = 50;
        this.health = 100;
        this.color = color;
        this.isAI = isAI;
    }

    setPosition(x: number, y: number): void {
        this.x = x;
        this.y = y;
    }

    setAngle(angle: number): void {
        this.angle = Math.max(0, Math.min(180, angle));
    }

    setPower(power: number): void {
        this.power = Math.max(10, Math.min(100, power));
    }

    takeDamage(damage: number): void {
        this.health = Math.max(0, this.health - damage);
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
        
        // Draw health bar
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - 15, canvasHeight - this.y - 20, 30, 5);
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x - 15, canvasHeight - this.y - 20, 30 * (this.health / 100), 5);
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

    constructor(x: number, y: number, angle: number, power: number, type: string = 'normal') {
        this.x = x;
        this.y = y;
        const angleRad = angle * Math.PI / 180;
        const speed = power * 0.15;
        this.vx = Math.cos(angleRad) * speed;
        this.vy = Math.sin(angleRad) * speed;
        this.type = type;
        this.active = true;
    }

    update(dt: number): void {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy -= 0.5 * dt; // Gravity
    }

    render(ctx: CanvasRenderingContext2D, canvasHeight: number): void {
        ctx.fillStyle = this.getColor();
        ctx.beginPath();
        ctx.arc(this.x, canvasHeight - this.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    private getColor(): string {
        switch (this.type) {
            case 'napalm': return '#FF4500';
            case 'nuke': return '#00FF00';
            case 'blackhole': return '#000000';
            default: return '#333333';
        }
    }

    getExplosionRadius(): number {
        switch (this.type) {
            case 'napalm': return 40;
            case 'nuke': return 80;
            case 'blackhole': return 60;
            default: return 30;
        }
    }

    getDamage(): number {
        switch (this.type) {
            case 'napalm': return 40;
            case 'nuke': return 80;
            case 'blackhole': return 60;
            default: return 30;
        }
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
        this.lifetime = type === 'nuke' ? 2.0 : 1.0;
        this.age = 0;
        this.createParticles();
    }

    private createParticles(): void {
        const count = this.type === 'nuke' ? 100 : 50;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
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
        
        for (const particle of this.particles) {
            particle.x += particle.vx * dt * 60;
            particle.y += particle.vy * dt * 60;
            particle.vy -= 0.3 * dt * 60;
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
