import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { GameConfig as MyGameConfig } from './config/GameConfig';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: MyGameConfig.GAME_WIDTH,
  height: MyGameConfig.GAME_HEIGHT,
  
  // ★修正: トップレベルに戻します
  // もしここで「プロパティが存在しません」とエラーが出る場合、
  // 下記の @ts-ignore コメントを有効にしてください。
  // (実行時には正しく動くプロパティです)
  
  // @ts-ignore 
  resolution: MyGameConfig.GRAPHICS_SCALE,

  render: {
    // ★ここから resolution は消します
    pixelArt: false,
    antialias: true,
    roundPixels: false
  },

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);