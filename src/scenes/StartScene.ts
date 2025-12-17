import Phaser from 'phaser';
import { GameConfig } from '../config/GameConfig';

export class StartScene extends Phaser.Scene {
  constructor() {
    super('StartScene');
  }

  preload() {
    // 背景画像のロード
    // public/assets/title_bg.png があることを想定しています
    this.load.image('title_bg', 'assets/title_bg.png');
  }

  create() {
    const { width, height } = this.scale;

    // --- 1. 背景の描画 ---
    // 画像がロードできていれば表示、なければ単色背景
    if (this.textures.exists('title_bg')) {
      const bg = this.add.image(width / 2, height / 2, 'title_bg');
      // 画面全体を覆うように拡大縮小（アスペクト比維持）
      const scaleX = width / bg.width;
      const scaleY = height / bg.height;
      const scale = Math.max(scaleX, scaleY);
      bg.setScale(scale).setScrollFactor(0);
    } else {
      this.cameras.main.setBackgroundColor(GameConfig.BG_COLOR);
    }

    // 文字を見やすくするために、半透明の黒い幕をかける
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);


    // --- 2. タイトルテキスト ---
    this.add.text(width / 2, height * 0.2, 'SHOGI\nSHOOTING', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold',
      fontFamily: 'serif',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);


    // --- 3. ルールと操作説明 ---
    const helpStyle = {
      fontSize: '18px',
      color: '#eeeeee',
      fontFamily: 'monospace',
      align: 'center',
      lineSpacing: 12
    };

    const helpText = `
【操作方法】
画面をドラッグして自機を移動
弾は自動で発射されます

【ルール】
迫りくる将棋の駒を撃ち落とせ！
敵を倒すと駒が進化してパワーアップ
ダメージを受けると退化します
「歩」の状態で被弾するとゲームオーバー
    `;
    
    this.add.text(width / 2, height * 0.5, helpText.trim(), helpStyle).setOrigin(0.5);


    // --- 4. スタートボタン (Click Start!) ---
    const startBtn = this.add.text(width / 2, height * 0.8, 'CLICK START!', {
      fontSize: '32px',
      color: '#ffff00',
      fontStyle: 'bold',
      fontFamily: 'sans-serif',
      backgroundColor: '#333333',
      padding: { x: 20, y: 10 }
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

    // 点滅アニメーション
    this.tweens.add({
      targets: startBtn,
      alpha: 0.6,
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    // クリック/タップでゲームシーンへ遷移
    // スマホ対応のため 'pointerup' を使用
    startBtn.once('pointerup', () => {
      // フェードアウトしながら遷移するおしゃれな演出
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('GameScene');
      });
    });
  }
}