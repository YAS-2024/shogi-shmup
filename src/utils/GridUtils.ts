import { GameConfig } from '../config/GameConfig';

export class GridUtils {
  static readonly COLS = 9;
  static readonly ROWS = 9;
  
  // 画面幅いっぱいに収める計算
  static readonly CELL_SIZE = GameConfig.GAME_WIDTH / GridUtils.COLS;

  // ★追加: UI表示用に上部にスペースを空ける (80px)
  static readonly OFFSET_Y = 80;

  /**
   * グリッド座標(col, row)を画面のピクセル座標(x, y)に変換
   */
  static gridToPixel(col: number, row: number): { x: number, y: number } {
    const halfSize = this.CELL_SIZE / 2;
    return {
      // ★修正: 「マスの左上」ではなく「マスの中心」を返す (+ halfSize)
      x: (col * this.CELL_SIZE) + halfSize,
      
      // ★修正: 「マスの中心」に加え、UIの分のオフセットを下げる (+ OFFSET_Y)
      y: (row * this.CELL_SIZE) + halfSize + this.OFFSET_Y
    };
  }

  /**
   * 画面のピクセル座標(x, y)をグリッド座標(col, row)に変換
   */
  static pixelToGrid(x: number, y: number): { col: number, row: number } {
    return {
      col: Math.floor(x / this.CELL_SIZE),
      // ★修正: オフセット分を引いてから計算
      row: Math.floor((y - this.OFFSET_Y) / this.CELL_SIZE)
    };
  }
}