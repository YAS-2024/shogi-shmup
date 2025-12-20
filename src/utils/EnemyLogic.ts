import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { GridUtils } from './GridUtils'; 
import type { AIProfile } from '../types/ConfigTypes';

export class EnemyLogic {
  
  /**
   * 次の移動先グリッドを決定する（予約マップを考慮）
   * @param reservedMap すでに他の駒が予約した座標 ("col,row" 形式の文字列Set)
   */
  static decideNextGrid(
    enemy: Enemy, 
    player: Player | null, 
    profile: AIProfile, 
    reservedMap: Set<string>
  ): { col: number, row: number } {
    
    if (!enemy.active) return GridUtils.pixelToGrid(enemy.x, enemy.y);

    const currentGrid = GridUtils.pixelToGrid(enemy.x, enemy.y);
    let bestGrid: { col: number, row: number } | null = null;

    // ■■■ 1. 入場行進ロジック ■■■
    // 目的地より手前なら、AI無視で「真下」を目指す
    if (currentGrid.row < enemy.destinationRow) {
       const candidate = { col: currentGrid.col, row: currentGrid.row + 1 };
       const key = `${candidate.col},${candidate.row}`;
       
       // もし前の人が詰まっていて進めないなら「その場で待機」
       if (reservedMap.has(key)) {
         return currentGrid;
       }
       return candidate;
    }

    // ■■■ 2. AI移動ロジック ■■■
    let targetX = enemy.scene.scale.width / 2;
    let targetY = enemy.scene.scale.height;
    if (player && player.active) {
       targetX = player.x;
       targetY = player.y;
    }

    // 移動候補の中からベストなものを探す（予約済みは除外）
    bestGrid = this.findBestNextGrid(currentGrid, profile.move_pattern, targetX, targetY, reservedMap);

    // 移動先がない場合は「その場に留まる」
    return bestGrid || currentGrid;
  }

  /**
   * 決定したグリッドへ実際に移動アニメーションを行う
   */
  static executeMove(enemy: Enemy, targetGrid: { col: number, row: number }, baseSpeed: number) {
    if (!enemy.active) return;

    const targetPixel = GridUtils.gridToPixel(targetGrid.col, targetGrid.row);
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    if (body) body.setVelocity(0, 0);

    const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, targetPixel.x, targetPixel.y);
    
    // 移動距離がほぼ0なら何もしない
    if (dist < 1) return;

    const duration = (dist / baseSpeed) * 1000 * 0.8; 

    enemy.scene.tweens.add({
      targets: enemy,
      x: targetPixel.x,
      y: targetPixel.y,
      duration: duration,
      ease: 'Cubic.out',
    });
  }

  /**
   * ベストな移動先マスを探す（予約Map対応版）
   */
  private static findBestNextGrid(
    current: { col: number, row: number },
    patterns: number[][],
    targetPixelX: number,
    targetPixelY: number,
    reservedMap: Set<string> // ★追加
  ): { col: number, row: number } | null {
    
    let bestGrid = null;
    let minDistanceSq = Number.MAX_VALUE;

    for (const pat of patterns) {
      const nextCol = current.col + pat[0];
      const nextRow = current.row + pat[1];

      // 画面外（左右）は除外
      if (nextCol < 0 || nextCol >= GridUtils.COLS) continue;

      // ★重要: すでに予約されているマスは除外
      if (reservedMap.has(`${nextCol},${nextRow}`)) continue;

      const nextPixel = GridUtils.gridToPixel(nextCol, nextRow);
      const distSq = Phaser.Math.Distance.Squared(nextPixel.x, nextPixel.y, targetPixelX, targetPixelY);

      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        bestGrid = { col: nextCol, row: nextRow };
      }
    }
    
    return bestGrid;
  }

  static stop(enemy: Enemy) {
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    if (body) body.setVelocity(0, 0);
    enemy.scene.tweens.killTweensOf(enemy);
  }
}