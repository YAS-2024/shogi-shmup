// src/config/GameConfig.ts

export const GameConfig = {
  // ゲームの論理サイズ (座標計算用)
  // ここは変えずに 9:16 の比率を保ちます
  GAME_WIDTH: 360,
  GAME_HEIGHT: 640,

  // ★画質係数 (Resolution Scale)
  // 1 = 標準 (360p相当: 軽い)
  // 2 = 高画質 (720p相当: HD)
  // 3 = 超高画質 (1080p相当: FHD)
  // ※PCや最新スマホなら 2〜3 がおすすめです
  GRAPHICS_SCALE: 3, 
  
  // 背景色
  BG_COLOR: '#444444'
};