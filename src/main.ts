import Phaser from 'phaser';
// ★追加: StartSceneをインポート
import { StartScene } from './scenes/StartScene';
import { GameScene } from './scenes/GameScene';
import { GameConfig as MyGameConfig } from './config/GameConfig';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: MyGameConfig.GAME_WIDTH,
  height: MyGameConfig.GAME_HEIGHT,
  
  // @ts-ignore 
  resolution: MyGameConfig.GRAPHICS_SCALE,

  render: {
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
  // ★変更: StartScene を配列の先頭に追加します
  scene: [StartScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);