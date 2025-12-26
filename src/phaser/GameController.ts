import Phaser from 'phaser';
import { Terrain } from '../terrain.js';
import { Tank } from '../tank.js';
import { GAME_CONFIG } from '../constants.js';
import { BaseProjectile, ProjectileFactory, DiggerProjectile, RollerProjectile } from '../projectiles/index.js';
import { applyTerrainEffect } from '../gameLogic/terrainEffects.js';

export class GameController {
  scene: Phaser.Scene;
  graphics: Phaser.GameObjects.Graphics;
  terrain: Terrain;
  tanks: Tank[] = [];
  projectiles: BaseProjectile[] = [];
  environment = { gravity: GAME_CONFIG.GRAVITY, windSpeed: 0 };
  // Use any here to avoid tight coupling to Phaser types
  particleManager?: any;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    const width = scene.scale.width;
    const height = scene.scale.height;
    this.terrain = new Terrain(width, height);

    // Simple particle texture
    const key = 'particle';
    const tex = this.scene.textures.createCanvas(key, 2, 2) as Phaser.Textures.CanvasTexture;
    const ctx = tex.getContext();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 2, 2);
    tex.refresh();
    this.particleManager = this.scene.add.particles(0, 0, key);

    // Create two tanks using existing model
    const t1 = new Tank(width * GAME_CONFIG.TANK1_X_RATIO, this.terrain.getHeight(width * GAME_CONFIG.TANK1_X_RATIO), '#0f62fe', 'Player 1');
    const t2 = new Tank(width * GAME_CONFIG.TANK2_X_RATIO, this.terrain.getHeight(width * GAME_CONFIG.TANK2_X_RATIO), '#fa4d56', 'Player 2', true);
    this.tanks.push(t1, t2);

    // Input: simple pointer click fires from current tank
    this.scene.input.on('pointerdown', () => this.fireCurrentWeapon());
  }

  fireCurrentWeapon() {
    const tank = this.tanks[0];
    const proj = ProjectileFactory.create(tank.x, tank.y, tank.angle, tank.power, tank.currentWeapon, tank.useContactTrigger);
    this.projectiles.push(proj);
  }

  private explode(proj: BaseProjectile) {
    const terrainHeight = this.terrain.getHeight(proj.x);
    const explodeX = proj.x;
    const explodeY = Math.max(proj.y, terrainHeight);
    const radius = proj.getExplosionRadius();
    const baseDamage = proj.getDamage();

    // Camera shake
    this.scene.cameras.main.shake(200, 0.01);

    // Terrain effect
    applyTerrainEffect(this.terrain, proj.type, explodeX, explodeY, radius);

    // Damage tanks
    for (const tank of this.tanks) {
      if (!tank.isAlive()) continue;
      const dist = Math.hypot(tank.x - explodeX, tank.y - explodeY);
      if (proj.type !== 'tracer' && dist < radius) {
        const damage = baseDamage * (1 - dist / radius);
        tank.takeDamage(damage);
      }
    }

    // Particles burst
    if (this.particleManager) {
      this.particleManager.createEmitter({
        x: explodeX,
        y: this.scene.scale.height - explodeY,
        speed: { min: 50, max: 150 },
        lifespan: 400,
        quantity: 30,
        scale: { start: 1, end: 0 },
        gravityY: 200,
        angle: { min: 0, max: 360 },
        blendMode: 'ADD'
      }).explode(40, explodeX, this.scene.scale.height - explodeY);
    }
  }

  update(dt: number) {
    // Update projectiles using existing logic then render via Phaser graphics
    const toRemove: BaseProjectile[] = [];
    for (const proj of this.projectiles) {
      proj.update(dt, this.environment.gravity, this.environment.windSpeed, this.terrain);
      const terrainHeight = this.terrain.getHeight(proj.x);
      const hitTerrain = proj.y <= terrainHeight;
      const outOfBounds = proj.x < 0 || proj.x > this.scene.scale.width;

      if (proj instanceof DiggerProjectile) {
        if (proj.useContactTrigger && hitTerrain) { this.explode(proj); toRemove.push(proj); }
        else if (proj.shouldExplode) { this.explode(proj); toRemove.push(proj); }
        else if (outOfBounds) toRemove.push(proj);
        continue;
      }
      if (proj instanceof RollerProjectile) {
        if (outOfBounds) { this.explode(proj); toRemove.push(proj); }
        continue;
      }
      if (hitTerrain || outOfBounds) { this.explode(proj); toRemove.push(proj); }
    }
    // Remove
    for (const p of toRemove) {
      const i = this.projectiles.indexOf(p);
      if (i > -1) this.projectiles.splice(i, 1);
    }

    // Render terrain and entities
    this.render();
  }

  render() {
    const g = this.graphics;
    g.clear();

    // Terrain: draw as line using heightmap
    g.lineStyle(2, 0x6b8e23, 1);
    g.beginPath();
    g.moveTo(0, this.scene.scale.height - this.terrain.getHeight(0));
    for (let x = 1; x < this.scene.scale.width; x++) {
      const y = this.scene.scale.height - this.terrain.getHeight(x);
      g.lineTo(x, y);
    }
    g.strokePath();

    // Tanks
    for (const t of this.tanks) {
      const y = this.scene.scale.height - t.y;
      g.fillStyle(0x333333, 1);
      g.fillRect(t.x - 12, y - 12, 24, 12);
      g.fillStyle(0x000000, 1);
      g.fillRect(t.x - 14, y - 2, 28, 4);
    }

    // Projectiles
    for (const p of this.projectiles) {
      const y = this.scene.scale.height - p.y;
      g.fillStyle(0xffffff, 1);
      g.fillCircle(p.x, y, 3);
    }
  }
}
