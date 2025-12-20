import Phaser from 'phaser';
import { Player } from './Player'; // 型定義用に使用(importのみ)
import { EnemyLogic } from '../utils/EnemyLogic';
import { GridUtils } from '../utils/GridUtils';
import type { EnemyConfig, AIProfile } from '../types/ConfigTypes';

export class Enemy extends Phaser.GameObjects.Container {
  public hp: number;
  public scoreValue: number;
  public speed: number;
  public destinationRow: number = 0;
  
  // ★変更: GameSceneから参照するため public に変更
  public aiProfile: AIProfile; 
  
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
    
    this.aiProfile = config.ai_profile || { 
      mode: 'grid_move', 
      move_pattern: [[0, 1]] 
    } as AIProfile;
    
    // --- 見た目の設定 (変更なし) ---
    const color = parseInt(config.texture_color || "0xE6CAA0");
    const shapePoints = [
        0, 15,    // 下
        20, 8,    // 右下
        15, -20,  // 右上
        -15, -20, // 左上
        -20, 8    // 左下
    ];

    this.bodyShape = scene.add.polygon(0, 0, shapePoints, color);
    this.bodyShape.setStrokeStyle(2, 0x5c4033);
    this.add(this.bodyShape);

    this.label = scene.add.text(-20, -25, config.name, {
      fontSize: '20px',
      color: '#000000',
      fontFamily: 'serif'
    }).setOrigin(0.5);
    
    this.label.setRotation(Math.PI);
    this.add(this.label);

    // --- 物理設定 (変更なし) ---
    const body = this.body as Phaser.Physics.Arcade.Body;
    const hitBoxSize = GridUtils.CELL_SIZE * 0.8; 
    body.setSize(hitBoxSize, hitBoxSize);
    body.setOffset(-hitBoxSize / 2 - 20, -hitBoxSize / 2 - 20);

    // ★変更: ここで 'start-turn' のリスナー登録は行わない
    // GameSceneが一括管理するため、個別に動くのを防ぎます
    scene.events.on('stop-turn', this.onStopTurn, this);
    
    this.on('destroy', () => {
      // scene.events.off('start-turn', this.onStartTurn, this); // 削除済み
      scene.events.off('stop-turn', this.onStopTurn, this);
    });
  }

  // ★変更: GameSceneから直接呼ばれる想定のため削除しても良いが、
  // アニメーション用などに残す場合はLogic呼び出しを削除する
  public onStartTurn() {
    // 自動では動かない
  }

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