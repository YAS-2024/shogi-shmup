// src/entities/Player.ts

import Phaser from 'phaser';
import { Bullet } from './Bullet';
import patternConfigData from '../config/patterns.json';
import playerConfigData from '../config/player_config.json';
import type { PlayerConfig, PatternConfig } from '../types/ConfigTypes';

export class Player extends Phaser.GameObjects.Container {
  private bodyShape: Phaser.GameObjects.Polygon;
  private label: Phaser.GameObjects.Text;
  private lastFiredTime: number = 0;
  // ★重要: 現在のランクを管理 (初期は "FU")
  private currentPieceId: string = 'FU'; 
  private isInvincible: boolean = false;
  private bulletsGroup: Phaser.Physics.Arcade.Group;

  constructor(
    scene: Phaser.Scene, 
    x: number, 
    y: number, 
    bulletsGroup: Phaser.Physics.Arcade.Group
  ) {
    super(scene, x, y);
    this.bulletsGroup = bulletsGroup;

    scene.add.existing(this);
    // ★追加: 物理演算を有効化 (敵と同じく当たり判定を持たせる)
    scene.physics.add.existing(this);

    // 形状
    const shapePoints = [0, -30, 20, -10, 15, 25, -15, 25, -20, -10];
    this.bodyShape = scene.add.polygon(0, 0, shapePoints, 0xdeb887);
    this.bodyShape.setStrokeStyle(2, 0x5c4033);
    this.add(this.bodyShape);

    // 文字
    this.label = scene.add.text(-20, -20, '歩', {
      fontSize: '24px',
      color: '#000000',
      fontFamily: 'serif'
    }).setOrigin(0.5);
    this.add(this.label);

    // ★追加: 当たり判定のサイズ調整 (少し小さめにして避けやすくするのがコツ)
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(30, 40);
    body.setOffset(-35, -40); // 中心に合わせる
  }
  // ★追加: プロモーション（進化）処理
  public promote() {
    // 既にやられていたら何もしない
    if (!this.active) return;

    const pConfig = playerConfigData as PlayerConfig;
    
    // 現在の駒がリストの何番目かを探す
    const currentIndex = pConfig.pieces.findIndex(p => p.id === this.currentPieceId);

    // 次の駒データが存在すれば進化する
    if (currentIndex >= 0 && currentIndex < pConfig.pieces.length - 1) {
      const nextPiece = pConfig.pieces[currentIndex + 1];
      
      // IDを更新（これで次のフレームから攻撃パターンが変わります）
      this.currentPieceId = nextPiece.id;

      // 見た目の文字を更新
      this.label.setText(nextPiece.name);
      
      console.log(`Promoted to ${nextPiece.name}!`);
    }
  }
  
  update(time: number, _delta: number) {  
    // ゲームオーバーなら操作不能にするなどの制御用に、activeチェックを入れると良い
    if (!this.active) return;

    const pointer = this.scene.input.activePointer;
    const { width, height } = this.scene.scale;
    this.x = Phaser.Math.Clamp(pointer.x, 20, width - 20);
    this.y = Phaser.Math.Clamp(pointer.y, 20, height - 20);

    this.handleShooting(time);
  }

  // ... (handleShooting, fire は変更なし) ...
  private handleShooting(time: number) {
      // (省略: そのまま)
      const pConfig = playerConfigData as PlayerConfig;
      const patterns = patternConfigData as PatternConfig[];
      const currentPiece = pConfig.pieces.find(p => p.id === this.currentPieceId);
      if (!currentPiece) return;
      const pattern = patterns.find(p => p.id === currentPiece.pattern_id);
      if (!pattern) return;
      if (time > this.lastFiredTime + pattern.interval_ms) {
        this.fire(pattern);
        this.lastFiredTime = time;
      }
  }

  private fire(pattern: PatternConfig) {
      // (省略: そのまま)
      pattern.projectiles.forEach(proj => {
        const bullet = new Bullet(
          this.scene, this.x - 20, this.y - 50, proj.angle, proj.speed
        );
        this.bulletsGroup.add(bullet);
      });
  }

  // ★追加: ダメージ処理
public takeDamage() {
    // 1. 既にやられている、または「無敵時間中」なら何もしない
    // ★ここが最も重要です！これで連続ヒットを防ぎます
    if (!this.active || this.isInvincible) return;

    const pConfig = playerConfigData as PlayerConfig;
    const currentIndex = pConfig.pieces.findIndex(p => p.id === this.currentPieceId);

    // 歩(インデックス0)ならゲームオーバー
    if (currentIndex <= 0) {
      this.die();
    } else {
      // ランクダウン処理
      const prevPiece = pConfig.pieces[currentIndex - 1];
      this.currentPieceId = prevPiece.id;
      this.label.setText(prevPiece.name);
      console.log(`Demoted to ${prevPiece.name}`);

      // ★追加: 無敵時間の開始
      this.triggerInvincibility();
    }
  }

  // ★追加: 無敵時間の処理メソッド
  private triggerInvincibility() {
    this.isInvincible = true;

    // 点滅アニメーション (100ms * 2 * 8回 = 約1.6秒間無敵)
    this.scene.tweens.add({
      targets: this,
      alpha: 0.1,    // 薄くする
      duration: 100, // 0.1秒で変化
      yoyo: true,    // 元に戻る
      repeat: 8,     // 8回繰り返す
      onComplete: () => {
        // アニメーションが終わったら無敵解除
        this.isInvincible = false;
        this.alpha = 1; // 完全に不透明に戻す
      }
    });
  }

  
private die() {
    // 二重実行防止
    if (!this.active) return;

    console.log("Player Exploded!");
    
    // 1. 自機の機能停止 (見た目を消し、更新を止める)
    this.setActive(false);
    this.setVisible(false);
    
    // 物理ボディも無効化 (これ以上当たり判定が発生しないように)
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
        body.enable = false; 
    }

    // 2. 爆発エフェクト (パーティクル) の生成
    // 自機の位置(this.x, this.y)を中心に火花を散らす
    const emitter = this.scene.add.particles(this.x, this.y, 'flare', {
        speed: { min: 50, max: 300 }, // 速さのランダム幅
        angle: { min: 0, max: 360 },  // 全方向に飛び散る
        scale: { start: 1, end: 0 },  // 最初は大きく、最後は消える
        lifespan: 800,                // 0.8秒で消滅
        blendMode: 'ADD',             // 加算合成（光っているように見える）
        quantity: 30                  // 一度に出る粒の数
    });
    
    // 爆発！ (一回だけ放出)
    emitter.explode(30);

    // 3. 少し待ってからゲームオーバー画面へ
    // 1000ms (1秒) 後にイベントを発火
    this.scene.time.delayedCall(1000, () => {
        this.scene.events.emit('game-over');
    });
  }
}