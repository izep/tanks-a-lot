import Phaser from 'phaser';
import { AIProfileId } from '../ai/profiles.js';
import { GameEngine, Notification } from '../game/GameEngine.js';
import { GAME_CONFIG } from '../constants.js';

type GameMode = '1player' | '2player';

interface StartConfig {
  mode: GameMode;
  aiProfile: AIProfileId;
}

interface HudElements {
  player: Phaser.GameObjects.Text;
  money: Phaser.GameObjects.Text;
  angle: Phaser.GameObjects.Text;
  power: Phaser.GameObjects.Text;
  weapon: Phaser.GameObjects.Text;
  contact: Phaser.GameObjects.Text;
  wind: Phaser.GameObjects.Text;
}

export default class GameScene extends Phaser.Scene {
  private engine!: GameEngine;
  private graphics!: Phaser.GameObjects.Graphics;
  private hud!: HudElements;
  private toastGroup!: Phaser.GameObjects.Container;
  private shopContainer!: Phaser.GameObjects.Container;
  private gameOverContainer!: Phaser.GameObjects.Container;
  private startConfig!: StartConfig;
  private hudDirty = true;

  constructor() {
    super('battle');
  }

  init(data: StartConfig) {
    this.startConfig = data;
  }

  create() {
    const { width, height } = this.scale;
    this.engine = new GameEngine(width, height);
    this.engine.startGame(this.startConfig.mode, this.startConfig.aiProfile);

    this.graphics = this.add.graphics();
    this.createHud();
    this.createControls();
    this.createToastLayer();
    this.createShopOverlay();
    this.createGameOverOverlay();
    this.configureInput();
  }

  update(_time: number, delta: number) {
    this.engine.update(delta / 1000);
    this.consumeNotifications();
    this.renderPlayfield();
    if (this.hudDirty) {
      this.refreshHud();
      this.hudDirty = false;
    }
    this.syncOverlays();
  }

  private createHud(): void {
    const padding = 12;
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff',
    };
    const baseY = 16;

    const player = this.add.text(padding, baseY, '', textStyle).setDepth(5);
    const money = this.add.text(padding, baseY + 26, '', textStyle).setDepth(5);
    const angle = this.add.text(padding, baseY + 52, '', textStyle).setDepth(5);
    const power = this.add.text(padding, baseY + 78, '', textStyle).setDepth(5);
    const weapon = this.add.text(this.scale.width - 240, baseY, '', textStyle).setDepth(5);
    const contact = this.add.text(this.scale.width - 240, baseY + 26, '', textStyle).setDepth(5);
    const wind = this.add.text(this.scale.width / 2 - 80, baseY, '', textStyle).setDepth(5);

    this.hud = { player, money, angle, power, weapon, contact, wind };
    this.hudDirty = true;
  }

  private createControls(): void {
    const buttonStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#1f487e',
      padding: { x: 12, y: 8 },
    };

    const createButton = (x: number, y: number, label: string, handler: () => void) => {
      const btn = this.add.text(x, y, label, buttonStyle)
        .setInteractive({ useHandCursor: true })
        .setDepth(5)
        .setOrigin(0.5);
      btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#22577a' }));
      btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#1f487e' }));
      btn.on('pointerdown', handler);
      return btn;
    };

    const bottomY = this.scale.height - 48;
    const spacing = 110;
    const startX = 120;

    createButton(startX, bottomY, 'Angle -', () => {
      this.engine.adjustAngle(-GAME_CONFIG.ANGLE_STEP);
      this.hudDirty = true;
    });
    createButton(startX + spacing, bottomY, 'Angle +', () => {
      this.engine.adjustAngle(GAME_CONFIG.ANGLE_STEP);
      this.hudDirty = true;
    });
    createButton(startX + spacing * 2, bottomY, 'Power -', () => {
      this.engine.adjustPower(-GAME_CONFIG.POWER_STEP);
      this.hudDirty = true;
    });
    createButton(startX + spacing * 3, bottomY, 'Power +', () => {
      this.engine.adjustPower(GAME_CONFIG.POWER_STEP);
      this.hudDirty = true;
    });
    createButton(startX + spacing * 4, bottomY, 'Weapon ◀', () => {
      this.engine.cycleWeapon(-1);
      this.hudDirty = true;
    });
    createButton(startX + spacing * 5, bottomY, 'Weapon ▶', () => {
      this.engine.cycleWeapon(1);
      this.hudDirty = true;
    });
    createButton(startX + spacing * 6, bottomY, 'Contact', () => {
      this.engine.toggleContactTrigger();
      this.hudDirty = true;
    });
    createButton(this.scale.width - 100, bottomY, 'FIRE!', () => {
      this.engine.fire();
    });
  }

  private createToastLayer(): void {
    this.toastGroup = this.add.container(0, 0);
  }

  private createShopOverlay(): void {
    const { width, height } = this.scale;
    const container = this.add.container(width / 2, height / 2).setDepth(10);
    const bg = this.add.rectangle(0, 0, width * 0.7, height * 0.6, 0x0b132b, 0.92);
    container.add(bg);

    const title = this.add.text(0, -height * 0.25, 'Round Complete', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5);
    container.add(title);

    const summary = this.add.text(0, -height * 0.15, '', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffd166',
    }).setOrigin(0.5);
    summary.setName('summary');
    container.add(summary);

    const buttonStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#ffffff',
      backgroundColor: '#1f487e',
      padding: { x: 16, y: 10 },
    };

    const createShopButton = (label: string, offsetY: number, handler: () => void) => {
      const text = this.add.text(0, offsetY, label, buttonStyle)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      text.on('pointerover', () => text.setStyle({ backgroundColor: '#22577a' }));
      text.on('pointerout', () => text.setStyle({ backgroundColor: '#1f487e' }));
      text.on('pointerdown', handler);
      container.add(text);
      return text;
    };

    createShopButton('Buy Shield ($200)', -30, () => this.handleShopPurchase('shield'));
    createShopButton('Buy Repair ($150)', 20, () => this.handleShopPurchase('repair'));
    createShopButton('Buy Contact Triggers ($1000)', 70, () => this.handleShopPurchase('contact_trigger'));
    createShopButton('Next Round', 140, () => this.completeShopPhase());

    container.setVisible(false);
    this.shopContainer = container;
  }

  private createGameOverOverlay(): void {
    const { width, height } = this.scale;
    const container = this.add.container(width / 2, height / 2).setDepth(10);
    const bg = this.add.rectangle(0, 0, width * 0.6, height * 0.4, 0x1f2933, 0.95);
    container.add(bg);

    const title = this.add.text(0, -60, 'Game Over', {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#ffffff',
    }).setOrigin(0.5);
    container.add(title);

    const summary = this.add.text(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffd166',
    }).setOrigin(0.5).setName('summary');
    container.add(summary);

    const button = this.add.text(0, 80, 'Return to Menu', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#1f487e',
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    button.on('pointerover', () => button.setStyle({ backgroundColor: '#22577a' }));
    button.on('pointerout', () => button.setStyle({ backgroundColor: '#1f487e' }));
    button.on('pointerdown', () => {
      this.engine.restartToMenu();
      this.scene.start('menu');
    });
    container.add(button);

    container.setVisible(false);
    this.gameOverContainer = container;
  }

  private configureInput(): void {
    this.input.keyboard?.on('keydown-LEFT', () => {
      this.engine.adjustAngle(GAME_CONFIG.ANGLE_STEP);
      this.hudDirty = true;
    });
    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.engine.adjustAngle(-GAME_CONFIG.ANGLE_STEP);
      this.hudDirty = true;
    });
    this.input.keyboard?.on('keydown-UP', () => {
      this.engine.adjustPower(GAME_CONFIG.POWER_STEP);
      this.hudDirty = true;
    });
    this.input.keyboard?.on('keydown-DOWN', () => {
      this.engine.adjustPower(-GAME_CONFIG.POWER_STEP);
      this.hudDirty = true;
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.engine.fire());
    this.input.keyboard?.on('keydown-ENTER', () => this.engine.fire());
  }

  private consumeNotifications(): void {
    const notes = this.engine.consumeNotifications();
    for (const note of notes) {
      if (note.message === 'HUD_UPDATE') {
        this.hudDirty = true;
        continue;
      }
      this.showToast(note);
    }
  }

  private refreshHud(): void {
    const hud = this.engine.getHudState();
    if (!hud) {
      return;
    }
    this.hud.player.setText(`Current: ${hud.playerName}`);
    this.hud.money.setText(`Money: $${hud.money}`);
    this.hud.angle.setText(`Angle: ${hud.angle}°`);
    this.hud.power.setText(`Power: ${hud.power}%`);
    this.hud.weapon.setText(`Weapon: ${hud.weapon}`);
    this.hud.contact.setText(`Triggers: ${hud.contactTriggers} (${hud.contactTriggerActive ? 'On' : 'Off'})`);
    this.hud.wind.setText(`Wind: ${hud.wind.toFixed(1)}`);
  }

  private showToast(note: Notification): void {
    const text = this.add.text(this.scale.width / 2, this.scale.height - 100, note.message, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: this.toastColor(note.type),
      padding: { x: 16, y: 10 },
    }).setOrigin(0.5);
    this.toastGroup.add(text);
    this.tweens.add({
      targets: text,
      alpha: { from: 1, to: 0 },
      y: '-=60',
      duration: (note.duration ?? 1800),
      ease: 'Sine.easeIn',
      onComplete: () => text.destroy(),
    });
  }

  private toastColor(type: Notification['type']): string {
    switch (type) {
      case 'success':
        return '#2d6a4f';
      case 'error':
        return '#bc4749';
      case 'warning':
        return '#e09f3e';
      default:
        return '#1f487e';
    }
  }

  private renderPlayfield(): void {
    this.graphics.clear();
    const { width, height } = this.scale;
    this.graphics.fillStyle(0x87ceeb, 1);
    this.graphics.fillRect(0, 0, width, height);

    const terrain = this.engine.getTerrain();
    if (terrain) {
      this.graphics.fillStyle(0x8b4513, 1);
      this.graphics.beginPath();
      this.graphics.moveTo(0, height);
      for (let x = 0; x < width; x++) {
        const y = height - terrain.getHeight(x);
        this.graphics.lineTo(x, y);
      }
      this.graphics.lineTo(width, height);
      this.graphics.closePath();
      this.graphics.fillPath();

      this.graphics.lineStyle(3, 0x228b22, 1);
      this.graphics.beginPath();
      this.graphics.moveTo(0, height - terrain.getHeight(0));
      for (let x = 1; x < width; x++) {
        this.graphics.lineTo(x, height - terrain.getHeight(x));
      }
      this.graphics.strokePath();
    }

    for (const tank of this.engine.getTanks()) {
      if (!tank.isAlive()) continue;
      const screenY = height - tank.y;
      this.graphics.fillStyle(0x333333, 1);
      this.graphics.fillRect(tank.x - 14, screenY - 2, 28, 4);
      this.graphics.fillStyle(Phaser.Display.Color.HexStringToColor(tank.color).color, 1);
      this.graphics.fillRect(tank.x - 12, screenY - 12, 24, 12);
      this.graphics.lineStyle(1, 0x000000, 1);
      this.graphics.strokeRect(tank.x - 12, screenY - 12, 24, 12);

      const angleRad = tank.angle * Math.PI / 180;
      const barrelLength = tank.getWeaponConfig().barrelLength;
      const endX = tank.x + Math.cos(angleRad) * barrelLength;
      const endY = screenY - Math.sin(angleRad) * barrelLength;
      this.graphics.lineStyle(tank.getWeaponConfig().barrelWidth + 1, 0x000000, 1);
      this.graphics.beginPath();
      this.graphics.moveTo(tank.x, screenY);
      this.graphics.lineTo(endX, endY);
      this.graphics.strokePath();
      this.graphics.lineStyle(tank.getWeaponConfig().barrelWidth, 0xffffff, 1);
      this.graphics.beginPath();
      this.graphics.moveTo(tank.x, screenY);
      this.graphics.lineTo(endX, endY);
      this.graphics.strokePath();

      const healthPercent = tank.health / tank.maxHealth;
      const healthY = screenY - 26;
      this.graphics.fillStyle(0x000000, 1);
      this.graphics.fillRect(tank.x - 15, healthY, 30, 6);
      const healthColor = healthPercent > 0.6 ? 0x2d6a4f : healthPercent > 0.3 ? 0xe09f3e : 0xbc4749;
      this.graphics.fillStyle(healthColor, 1);
      this.graphics.fillRect(tank.x - 15, healthY, 30 * healthPercent, 6);

            this.graphics.fillStyle(0xffffff, 1);
            this.graphics.fillRect(tank.x - 20, healthY - 18, 40, 16);
            this.graphics.lineStyle(1, 0x000000, 1);
            this.graphics.strokeRect(tank.x - 20, healthY - 18, 40, 16);
    }

    for (const proj of this.engine.getProjectiles()) {
      const screenY = height - proj.y;
      this.graphics.fillStyle(0xffffff, 1);
      this.graphics.fillCircle(proj.x, screenY, 3);
    }

    for (const pool of this.engine.getNapalmPools()) {
      const screenY = height - pool.y;
      this.graphics.fillStyle(0xff4500, 0.4);
      this.graphics.fillCircle(pool.x, screenY, pool.radius);
    }

    for (const explosion of this.engine.getExplosions()) {
      for (const particle of explosion.particles) {
        if (particle.life <= 0) continue;
        const color = Phaser.Display.Color.GetColor(255, Math.floor(100 * particle.life), 0);
        this.graphics.fillStyle(color, particle.life);
        this.graphics.fillCircle(particle.x, height - particle.y, 2);
      }
    }
  }

  private handleShopPurchase(item: string): void {
    this.engine.buyItem(item);
    this.hudDirty = true;
  }

  private completeShopPhase(): void {
    this.engine.completeShopPhase();
    this.shopContainer.setVisible(false);
    this.hudDirty = true;
  }

  private syncOverlays(): void {
    const phase = this.engine.getPhase();
    if (phase === 'shop') {
      const summary = this.engine.getShopSummary();
      if (summary) {
        const text = this.shopContainer.getByName('summary') as Phaser.GameObjects.Text;
        const winnerName = summary.winnerIndex >= 0 ? `Player ${summary.winnerIndex + 1}` : 'Draw';
        text.setText(`${winnerName} earned $${summary.reward}`);
      }
      this.shopContainer.setVisible(true);
      this.gameOverContainer.setVisible(false);
    } else if (phase === 'gameover') {
      const info = this.engine.getGameOverSummary();
      if (info) {
        const text = this.gameOverContainer.getByName('summary') as Phaser.GameObjects.Text;
        text.setText(info.winnerIndex >= 0 ? `Player ${info.winnerIndex + 1} wins!` : `It's a draw!`);
      }
      this.shopContainer.setVisible(false);
      this.gameOverContainer.setVisible(true);
    } else {
      this.shopContainer.setVisible(false);
      this.gameOverContainer.setVisible(false);
    }
  }
}
