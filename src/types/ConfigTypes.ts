// 攻撃パターンの定義
export interface ProjectileConfig {
  angle: number;
  speed: number;
}

export interface PatternConfig {
  id: string;
  description: string;
  range: number;
  interval_ms: number;
  projectiles: ProjectileConfig[];
}

// 自機の定義
export interface PlayerPieceConfig {
  id: string;
  name: string;
  pattern_id: string;
  speed: number;
}

export interface RankProgression {
  rank: number;
  piece_id: string;
  next: string; // 次のランクのID
  prev: string; // 被弾時のランクダウン先ID
}

export interface PlayerConfig {
  pieces: PlayerPieceConfig[];
  rank_progression: RankProgression[];
}

// 敵の定義
export interface EnemyConfig {
  id: string;
  name: string;
  hp: number;
  score: number;
  speed: number;
  pattern_id: string;
}

export interface EnemyConfigRoot {
  enemy_types: EnemyConfig[];
}
// 型定義もここでexportしておくと便利です
export interface AIProfile {
  // 動きのモード ('strategic_move' に統一)
  mode: 'strategic_move'; 
  
  // 速度倍率
  speed_rate: number; 
  
  // 動ける角度のリスト
  movable_angles: number[]; 
}

export interface EnemyConfig {
  id: string;
  name: string;
  hp: number;
  score: number;
  speed: number;
  width: number;
  height: number;
  texture_color: string;
  
  // ★ここも AIProfile を使うようになっているか確認
  ai_profile?: AIProfile; 
}

export interface EnemyConfigRoot {
  enemy_types: EnemyConfig[];
}
export interface EnemyConfigRoot {
  enemy_types: EnemyConfig[];
}
