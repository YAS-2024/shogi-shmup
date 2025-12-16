import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { GridUtils } from './GridUtils'; 
import type { AIProfile } from '../types/ConfigTypes';

export class EnemyLogic {
  /**
   * グリッドベースの移動ロジック
   */
  static applyMove(enemy: Enemy, player: Player | null, profile: AIProfile, baseSpeed: number) {
    if (!enemy.active) return;

    // 1. 自分の現在位置をグリッド座標に変換
    const currentGrid = GridUtils.pixelToGrid(enemy.x, enemy.y);

    // 2. プレイヤーの位置（ターゲット）を取得
    // プレイヤーが死んでいる場合は、とりあえず「画面下端の中央」を目指す
    let targetX = enemy.scene.scale.width / 2;
    let targetY = enemy.scene.scale.height;

    if (player && player.active) {
      targetX = player.x;
      targetY = player.y;
    }

    // 3. 移動パターンの候補から、ベストな移動先(グリッド)を探す
    const bestGrid = this.findBestNextGrid(currentGrid, profile.move_pattern, targetX, targetY);

    // 4. 移動先が決まったら、そこへ向かって移動開始 (Pixel座標に変換)
    if (bestGrid) {
      const targetPixel = GridUtils.gridToPixel(bestGrid.col, bestGrid.row);
      
      // ★修正: speed_rate は廃止されたため、baseSpeed (JSONのspeed) をそのまま使います
      // また、物理演算(moveTo)は使わず、Tweenのみで移動させます
      this.moveByTween(enemy, targetPixel.x, targetPixel.y, baseSpeed);
    }
  }

  /**
   * ベストな移動先マスを探す
   */
  private static findBestNextGrid(
    current: { col: number, row: number },
    patterns: number[][],
    targetPixelX: number,
    targetPixelY: number
  ): { col: number, row: number } | null {
    
    let bestGrid = null;
    let minDistanceSq = Number.MAX_VALUE;

    for (const pat of patterns) {
      const nextCol = current.col + pat[0];
      const nextRow = current.row + pat[1];

      // 画面外（左右）に出る動きは除外
      if (nextCol < 0 || nextCol >= GridUtils.COLS) continue;

      // 候補マスのピクセル座標
      const nextPixel = GridUtils.gridToPixel(nextCol, nextRow);

      // ターゲットとの距離を計算
      const distSq = Phaser.Math.Distance.Squared(nextPixel.x, nextPixel.y, targetPixelX, targetPixelY);

      // より近くなるなら更新
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        bestGrid = { col: nextCol, row: nextRow };
      }
    }
    
    // 候補がなければ null を返してその場待機
    return bestGrid;
  }

  /**
   * 物理移動ではなくTweenアニメーションで動かす（将棋っぽい挙動）
   */
  private static moveByTween(enemy: Enemy, targetX: number, targetY: number, speed: number) {
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    // 物理速度は0にする（干渉しないように）
    if (body) body.setVelocity(0, 0);

    // 距離計算
    const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, targetX, targetY);
    if (dist < 1) return; // すでにいる

    // 時間 = 距離 / 速度 * 1000
    // 少しキビキビ動かしたいので係数を調整 (0.8倍)
    const duration = (dist / speed) * 1000 * 0.8; 

    enemy.scene.tweens.add({
      targets: enemy,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: 'Cubic.out', // すっと動いて減速して止まる
      onComplete: () => {
        // 到着後の処理があれば記述
      }
    });
  }

  static stop(enemy: Enemy) {
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    if (body) body.setVelocity(0, 0);
    enemy.scene.tweens.killTweensOf(enemy); // 移動アニメーションも止める
  }
}