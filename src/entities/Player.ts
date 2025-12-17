import Phaser from 'phaser';
import { Bullet } from './Bullet';
import patternConfigData from '../config/patterns.json';
import playerConfigData from '../config/player_config.json';
import type { PlayerConfig, PatternConfig } from '../types/ConfigTypes';

export class Player extends Phaser.GameObjects.Container {
  // ★重要: GameSceneからの参照用に public hp を追加
  // 歩(Index 0) = HP 1, 香(Index 1) = HP 2 ... という扱いにします
  public hp: number = 1;
　// ★追加: 現在のランク数値 (0:歩, 1:香, ...)
  public currentRank: number = 0;
  private bodyShape: Phaser.GameObjects.Polygon;
  private label: Phaser.GameObjects.Text;
  private lastFiredTime: number = 0;
  
  // 現在のランクを管理 (初期は "FU")
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
    scene.physics.add.existing(this);

    // HP初期化 (最初は歩なので 1)
    this.hp = 1;
    this.currentRank = 0; // ★初期化
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

    // 当たり判定のサイズ調整
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(30, 40);
    body.setOffset(-35, -40); // 中心に合わせる
    body.setCollideWorldBounds(true);
  }

  // プロモーション（進化）処理
  public promote() {
    if (!this.active) return;

    const pConfig = playerConfigData as PlayerConfig;
    const currentIndex = pConfig.pieces.findIndex(p => p.id === this.currentPieceId);

    // 次の駒データが存在すれば進化する
    if (currentIndex >= 0 && currentIndex < pConfig.pieces.length - 1) {
      const nextPiece = pConfig.pieces[currentIndex + 1];
      
      this.currentPieceId = nextPiece.id;
      this.label.setText(nextPiece.name);
      
      // ★追加: 進化したらHP（耐久力）も増やす
      this.hp = currentIndex + 2; 
      // ★追加: ランク更新
      this.currentRank = currentIndex + 1;
      console.log(`Promoted to ${nextPiece.name}! (HP: ${this.hp})`);
      
      // 進化演出（少し跳ねるなど）
      this.scene.tweens.add({
          targets: this,
          scale: { from: 1.2, to: 1 },
          duration: 200,
          ease: 'Back.out'
      });
    }
  }
  
  update(time: number, _delta: number) {  
    if (!this.active) return;

    const pointer = this.scene.input.activePointer;
    const { width, height } = this.scene.scale;
    
    // ポインター追従 (クランプ付き)
    this.x = Phaser.Math.Clamp(pointer.x, 20, width - 20);
    this.y = Phaser.Math.Clamp(pointer.y, 20, height - 20);

    this.handleShooting(time);
  }

  private handleShooting(time: number) {
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
      pattern.projectiles.forEach(proj => {
        const bullet = new Bullet(
          this.scene, this.x - 20, this.y - 50, proj.angle, proj.speed
        );
        this.bulletsGroup.add(bullet);
      });
  }

  // ダメージ処理
  public takeDamage() {
    // 既にやられている、または「無敵時間中」なら何もしない
    if (!this.active || this.isInvincible) return;

    const pConfig = playerConfigData as PlayerConfig;
    const currentIndex = pConfig.pieces.findIndex(p => p.id === this.currentPieceId);

    // 歩(インデックス0)ならゲームオーバー
    if (currentIndex <= 0) {
      // ★HPを0にして、GameSceneに死亡を伝える
      this.hp = 0;
      this.die();
    } else {
      // ランクダウン処理
      const prevPiece = pConfig.pieces[currentIndex - 1];
      this.currentPieceId = prevPiece.id;
      this.label.setText(prevPiece.name);
      
      // ★HPを現在のランク(インデックス+1)に合わせる
      this.hp = currentIndex; 
      // ★追加: ランク更新 (下がる)
      this.currentRank = currentIndex - 1;      
      console.log(`Demoted to ${prevPiece.name} (HP: ${this.hp})`);

      // 無敵時間の開始
      this.triggerInvincibility();
    }
  }

  // 無敵時間の処理メソッド
  private triggerInvincibility() {
    this.isInvincible = true;

    // 点滅アニメーション
    this.scene.tweens.add({
      targets: this,
      alpha: 0.1,    // 薄くする
      duration: 100, // 0.1秒で変化
      yoyo: true,    // 元に戻る
      repeat: 8,     // 8回繰り返す (約1.6秒)
      onComplete: () => {
        this.isInvincible = false;
        this.alpha = 1; // 完全に不透明に戻す
      }
    });
  }
  
  private die() {
    if (!this.active) return;
    console.log("Player Exploded!");
    
    // 1. 自機の機能停止
    this.setActive(false);
    this.setVisible(false);
    
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
        body.enable = false; 
    }

    // 2. 爆発エフェクト
    // GameSceneで生成された 'flare' テクスチャを使用
    const emitter = this.scene.add.particles(this.x, this.y, 'flare', {
        speed: { min: 50, max: 300 },
        angle: { min: 0, max: 360 },
        scale: { start: 1, end: 0 },
        lifespan: 800,
        blendMode: 'ADD',
        quantity: 30,
        emitting: false // 自動放出しない
    });
    
    // 一回だけ爆発
    emitter.explode(30);

    // GameScene側で hp <= 0 を検知して gameOver() が呼ばれるため、
    // ここでのイベント発火は削除しても動きますが、念のため残しておきます。
    // (GameSceneの作りによっては両方あると安全です)
  }
  
  // GameSceneのリトライ機能などで色を戻す必要がある場合に備えて追加
  public setTint(color: number) {
      this.bodyShape.setFillStyle(color);
  }
}