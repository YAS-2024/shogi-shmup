import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 600,
  height: 800,
  backgroundColor: '#2d2d2d',
  // ★★★ 以下の physics ブロックを追加/確認してください ★★★
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 }, // 宇宙なので重力なし
      debug: true
    }
  },
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
  scene: [GameScene]
};

new Phaser.Game(config);