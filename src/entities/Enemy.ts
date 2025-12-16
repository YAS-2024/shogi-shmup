import Phaser from 'phaser';
import { Player } from './Player';

import { EnemyLogic} from '../utils/EnemyLogic'; // ★追加
import type { EnemyConfig, AIProfile } from '../types/ConfigTypes';


export class Enemy extends Phaser.GameObjects.Container {
  public hp: number;
  public scoreValue: number;
  private speed: number;
  
  // ★ movementType を廃止し、aiProfile を持つ
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
    
    // ★ JSONから設定を読み込む (なければデフォルト値)    
  // ★修正: 後ろに "as AIProfile" をつけて型を保証する
    this.aiProfile = config.ai_profile || { 
      mode: 'strategic_move', 
      speed_rate: 1.0, 
      movable_angles: [90] 
    } as AIProfile;
    
    // --- ここから見た目の設定 (変更なし) ---
    const color = parseInt(config.texture_color || "0xE6CAA0");
    const shapePoints = [0, 20, 20, 10, 15, -25, -15, -25, -20, 10];
    this.bodyShape = scene.add.polygon(0, 0, shapePoints, color);
    this.bodyShape.setStrokeStyle(2, 0x5c4033);
    this.add(this.bodyShape);

    this.label = scene.add.text(-20, -30, config.name, {
      fontSize: '20px',
      color: '#000000',
      fontFamily: 'serif'
    }).setOrigin(0.5);
    this.label.setRotation(Math.PI);
    this.add(this.label);
    // ------------------------------------

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(config.width, config.height);
  // ▼▼▼▼▼▼ 追加: ここで中心位置を調整します ▼▼▼▼▼▼
    // 幅と高さの半分をマイナス方向にずらすことで、コンテナの中心に合わせます
    body.setOffset(-config.width / 2-20, -config.height / 2-20);
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲


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