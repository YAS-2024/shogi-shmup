import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import type { AIProfile } from '../types/ConfigTypes';

export class EnemyLogic {
  /**
   * 駒ごとの移動可能角度の中から、最もプレイヤーに近づける方向を選択して移動する
   */
  static applyMove(enemy: Enemy, player: Player | null, profile: AIProfile, baseSpeed: number) {
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    if (!body || !enemy.active) return;

    // 基本速度
    const speed = baseSpeed * profile.speed_rate;

    // プレイヤーがいない場合は、とりあえず「真下(90度)」に近い角度を選ぶ
    const targetX = player && player.active ? player.x : enemy.x;
    const targetY = player && player.active ? player.y : enemy.y + 1000;

    // ベストな角度を探す
    const bestAngle = this.findBestAngle(enemy, targetX, targetY, profile.movable_angles);

    // 速度ベクトルを設定
    const rad = Phaser.Math.DegToRad(bestAngle);
    const vx = Math.cos(rad) * speed;
    const vy = Math.sin(rad) * speed;

    body.setVelocity(vx, vy);
  }

  /**
   * 選択肢の中で、ターゲット(プレイヤー)への距離が最小になる角度を返す
   */
  private static findBestAngle(enemy: Enemy, targetX: number, targetY: number, angles: number[]): number {
    if (!angles || angles.length === 0) return 90; // デフォルトは下

    let bestAngle = angles[0];
    let minDistance = Number.MAX_VALUE;

    // すべての候補角度についてシミュレーション
    for (const angle of angles) {
      // その方向に1単位進んだ場合の座標を計算
      const rad = Phaser.Math.DegToRad(angle);
      const testX = enemy.x + Math.cos(rad);
      const testY = enemy.y + Math.sin(rad);

      // ターゲットとの距離(の2乗)を計算
      const distSq = Phaser.Math.Distance.Squared(testX, testY, targetX, targetY);

      // より近くなるなら更新
      if (distSq < minDistance) {
        minDistance = distSq;
        bestAngle = angle;
      }
    }

    return bestAngle;
  }

  static stop(enemy: Enemy) {
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setVelocity(0, 0);
    }
  }
}