import Phaser from 'phaser';
import MenuScene from './MenuScene.js';
import GameScene from './GameScene.js';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 800,
  height: 600,
  backgroundColor: '#1e1e1e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [MenuScene, GameScene],
};

// Replace existing canvas usage by mounting Phaser
export function startPhaser() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const game = new Phaser.Game(config);
}

// Auto-start when loaded
startPhaser();
