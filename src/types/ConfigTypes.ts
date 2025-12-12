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