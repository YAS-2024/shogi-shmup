import { GameConfig } from '../config/GameConfig'; // ★追加

export class GridUtils {
  static readonly COLS = 9;
  static readonly ROWS = 16;
  
  // ★変更: 設定ファイルから計算
  static readonly CELL_SIZE = GameConfig.GAME_WIDTH / 9;

  static gridToPixel(col: number, row: number): { x: number, y: number } {
    const x = col * this.CELL_SIZE + (this.CELL_SIZE / 2);
    const y = row * this.CELL_SIZE + (this.CELL_SIZE / 2);
    return { x, y };
  }

  static pixelToGrid(x: number, y: number): { col: number, row: number } {
    const col = Math.floor(x / this.CELL_SIZE);
    const row = Math.floor(y / this.CELL_SIZE);
    return { col, row };
  }

  static isValidGrid(col: number, row: number): boolean {
    return col >= 0 && col < this.COLS && row >= -5 && row < this.ROWS + 2; 
  }
}