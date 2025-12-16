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
  mode: 'grid_move';
  
  
  // ★変更: 相対座標のリスト [[0, 1], [-1, 2]] など
  // [x方向(右+,左-), y方向(下+,上-)]
  move_pattern: number[][]; 
}

export interface EnemyConfig {
  id: string;
  name: string;
  hp: number;
  score: number;
  speed: number;
  texture_color: string;
  ai_profile?: AIProfile;
}

export interface EnemyConfigRoot {
  enemy_types: EnemyConfig[];
}
export interface EnemyConfigRoot {
  enemy_types: EnemyConfig[];
}

// Wave定義用の型も追加しておきます
export interface WaveEnemyDef {
  type: string;  // "ENEMY_FU" など
  gridX: number; // 0~8
  gridY: number; // 0, -1, -2...
}

export interface WaveConfig {
  id: string;
  difficulty: number;
  enemies: WaveEnemyDef[];
}

export interface WaveConfigRoot {
  waves: WaveConfig[];
}

export interface EnemyConfigRoot {
  enemy_types: EnemyConfig[];
}