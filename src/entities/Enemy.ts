import Phaser from 'phaser';
import { Player } from './Player';
import { EnemyLogic } from '../utils/EnemyLogic';
import { GridUtils } from '../utils/GridUtils'; // ★追加: サイズ計算用
import type { EnemyConfig, AIProfile } from '../types/ConfigTypes';

export class Enemy extends Phaser.GameObjects.Container {
  public hp: number;
  public scoreValue: number;
  public speed: number; // private -> publicに変更 (Logicから参照するため)
  public destinationRow: number = 0;
  private aiProfile: AIProfile;
  
  private bodyShape: Phaser.GameObjects.Polygon;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemyConfig) {
    super(scene, x, y);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.hp = config.hp;
    this.scoreValue = config.score;
    this.speed = config.speed;
    this.destinationRow = 0;
    // ★修正: デフォルト値を新しい AIProfile の定義に合わせる (speed_rate削除)
    this.aiProfile = config.ai_profile || { 
      mode: 'grid_move', 
      move_pattern: [[0, 1]] 
    } as AIProfile;
    
    // --- ここから見た目の設定 ---
    const color = parseInt(config.texture_color || "0xE6CAA0");
    
    // ★修正: 縦の重なりを減らすため、少し高さを縮めた形状
    const shapePoints = [
        0, 15,    // 下 (以前は 20)
        20, 8,    // 右下 (以前は 10)
        15, -20,  // 右上 (以前は -25)
        -15, -20, // 左上 (以前は -25)
        -20, 8    // 左下 (以前は 10)
    ];

    this.bodyShape = scene.add.polygon(0, 0, shapePoints, color);
    this.bodyShape.setStrokeStyle(2, 0x5c4033);
    this.add(this.bodyShape);

    this.label = scene.add.text(-20, -25, config.name, { // 0,0 に配置
      fontSize: '20px',
      color: '#000000',
      fontFamily: 'serif'
    }).setOrigin(0.5); // 中心揃え
    
    this.label.setRotation(Math.PI);
    this.add(this.label);
    // ------------------------------------

    // --- 物理設定 ---
    const body = this.body as Phaser.Physics.Arcade.Body;
    
    // ★修正: config.width がなくなったので、グリッドサイズから自動計算 (80%の大きさ)
    const hitBoxSize = GridUtils.CELL_SIZE * 0.8; 
    body.setSize(hitBoxSize, hitBoxSize);

    // ★修正: 中心合わせ + マジックナンバー調整 (-20)
    // 幅と高さの半分をマイナスし、さらに -20 して位置を微調整
    body.setOffset(-hitBoxSize / 2 - 20, -hitBoxSize / 2 - 20);

    // イベントリスナー登録
    scene.events.on('start-turn', this.onStartTurn, this);
    scene.events.on('stop-turn', this.onStopTurn, this);
    
    this.on('destroy', () => {
      scene.events.off('start-turn', this.onStartTurn, this);
      scene.events.off('stop-turn', this.onStopTurn, this);
    });
  }

  // ★ 汎用ロジッククラスを使って移動
  public onStartTurn() {
    if (!this.active) return;
    
    // シーンからプレイヤーを取得 (簡易的にキャストして取得)
    const player = (this.scene as any).player as Player;
    
    // Logicに渡す
    EnemyLogic.applyMove(this, player, this.aiProfile, this.speed);
  }

  // ★ 汎用ロジッククラスを使って停止
  public onStopTurn() {
    if (!this.active) return;
    EnemyLogic.stop(this);
  }

  update(_time: number, _delta: number) {
    if (this.y > this.scene.scale.height + 50) {
      this.destroy();
    }
  }

  public takeDamage(damage: number): boolean {
    this.hp -= damage;
    if (this.hp <= 0) {
      // 破壊時にリスナー解除を忘れない
      this.scene.events.off('start-turn', this.onStartTurn, this);
      this.scene.events.off('stop-turn', this.onStopTurn, this);
      this.destroy();
      return true;
    }
    this.scene.tweens.add({
        targets: this,
        alpha: 0.5,
        duration: 50,
        yoyo: true,
        repeat: 1
    });
    return false;
  }
}