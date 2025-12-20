import Phaser from 'phaser';
import { Player } from './Player'; 
import { EnemyLogic } from '../utils/EnemyLogic';
import { GridUtils } from '../utils/GridUtils';
import type { EnemyConfig, AIProfile } from '../types/ConfigTypes';

export class Enemy extends Phaser.GameObjects.Container {
  public hp: number;
  public scoreValue: number;
  public speed: number;
  public destinationRow: number = 0;
  
  public aiProfile: AIProfile; 
  
  private bodyGraphics: Phaser.GameObjects.Graphics; 
  private label: Phaser.GameObjects.Text;
  
  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemyConfig) {
    super(scene, x, y);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.hp = config.hp;
    this.scoreValue = config.score;
    this.speed = config.speed;
    this.destinationRow = 0;
    
    this.aiProfile = config.ai_profile || { 
      mode: 'grid_move', 
      move_pattern: [[0, 1]] 
    } as AIProfile;
    
    // --- 見た目の設定 ---
const color = parseInt(config.texture_color || "0xE6CAA0");
    
    // ★変更: 頂点座標を {x, y} のオブジェクト配列にする
    const shapePoints = [
        { x: 0, y: 15 },    // 下
        { x: 20, y: 8 },    // 右下
        { x: 15, y: -20 },  // 右上
        { x: -15, y: -20 }, // 左上
        { x: -20, y: 8 }    // 左下
    ];
    // ★変更: Graphicsを作成して描画
    this.bodyGraphics = scene.add.graphics();
    this.bodyGraphics.fillStyle(color, 1);
    this.bodyGraphics.fillPoints(shapePoints, true, true);
    this.bodyGraphics.lineStyle(2, 0x5c4033);
    this.bodyGraphics.strokePoints(shapePoints, true, true);
    
    this.add(this.bodyGraphics);
    // テキスト位置調整 (中心に合わせる)
    this.label = scene.add.text(0, -5, config.name, {
      fontSize: '20px',
      color: '#000000',
      fontFamily: 'serif'
    }).setOrigin(0.5);
    
    this.label.setRotation(Math.PI);
    this.add(this.label);

    // --- 物理設定 (ここが重要) ---
    const body = this.body as Phaser.Physics.Arcade.Body;
    
    // グリッドサイズの80%を当たり判定とする
    const hitBoxSize = GridUtils.CELL_SIZE * 0.8; 
    body.setSize(hitBoxSize, hitBoxSize);

    // ★重要修正: 純粋にサイズの半分だけマイナスして中心を合わせる
    // 余計な数値(-20など)は入れないでください
    body.setOffset(-hitBoxSize / 2, -hitBoxSize / 2);

    scene.events.on('stop-turn', this.onStopTurn, this);
    
    this.on('destroy', () => {
      scene.events.off('stop-turn', this.onStopTurn, this);
    });
  }

  // (以下変更なし)
  public onStartTurn() { /* ... */ }

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