import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import { Item } from '../entities/Item';
import { GridUtils } from '../utils/GridUtils';
import { GameConfig } from '../config/GameConfig';

import enemyConfigData from '../config/enemy_config.json';
import waveConfigData from '../config/wave_config.json';
import type { EnemyConfigRoot, WaveConfigRoot } from '../types/ConfigTypes';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;      
  private enemyBullets!: Phaser.Physics.Arcade.Group; 
  private items!: Phaser.Physics.Arcade.Group;        
  
  // Wave管理用
  private waveTimer: number = 0;
  private nextWaveInterval: number = 4000;
  
  // 難易度管理用
  private baseDifficulty: number = 0; 
  private difficultyTimer: number = 0;
  private stageText!: Phaser.GameObjects.Text;
  
  private isGameOver: boolean = false;
  
  // スコア・コンボ関連
  private score: number = 0;
  private combo: number = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private comboTimer?: Phaser.Time.TimerEvent;

  // ターン管理用
  private isEnemyTurn: boolean = false;

  constructor() {
    super('GameScene');
  }

  create() {
    this.isGameOver = false;
    this.score = 0;
    this.combo = 0;
    this.isEnemyTurn = false;
    
    this.waveTimer = 0;
    this.nextWaveInterval = 4000;
    
    // 難易度初期化
    this.baseDifficulty = 0;
    this.difficultyTimer = 0;

    this.cameras.main.setBackgroundColor(GameConfig.BG_COLOR || '#444444');

    // UI設定
    this.scoreText = this.add.text(20, 20, 'SCORE: 0', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setDepth(100);

    // ステージ表示
    this.stageText = this.add.text(this.scale.width - 20, 20, 'STAGE 1', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'monospace',
      align: 'right'
    }).setOrigin(1, 0).setDepth(100);

    this.comboText = this.add.text(20, 55, '', {
      fontSize: '24px',
      color: '#ffff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setDepth(100);

    // グループ初期化
    this.bullets = this.physics.add.group({ classType: Bullet, runChildUpdate: true });
    this.enemyBullets = this.physics.add.group({ classType: Bullet, runChildUpdate: true });
    this.enemies = this.physics.add.group({ classType: Enemy, runChildUpdate: true });
    this.items = this.physics.add.group({ classType: Item, runChildUpdate: true });

    // 自機生成
    const { width, height } = this.scale;
    // 画面下から20%の位置
    this.player = new Player(this, width / 2, height * 0.8, this.bullets);

    // 衝突判定
    this.physics.add.overlap(this.bullets, this.enemies, this.handleBulletEnemyCollision, undefined, this);
    this.physics.add.overlap(this.enemies, this.player, this.handlePlayerHit, undefined, this);
    this.physics.add.overlap(this.enemyBullets, this.player, this.handlePlayerHit, undefined, this);
    this.physics.add.overlap(this.player, this.items, this.handlePlayerItemCollision, undefined, this);

    this.input.setDefaultCursor('none');

    // ターン制サイクルの開始
    this.startTurnCycle();
  }

  // 共通メソッド: 現在のステージ（難易度）を計算
  private getCurrentStage(): number {
    // プレイヤーランク(0~) + 基礎時間難易度(0~) + 1
    // Playerが存在しない場合は安全に 1 を返す
    const playerRank = this.player ? this.player.currentRank : 0;
    return playerRank + this.baseDifficulty + 1;
  }

  // ターン管理ロジック (停止時間が可変になる)
  private startTurnCycle() {
    const moveDuration = 2000; // 移動時間は2秒固定

    const loopTurn = () => {
      if (this.isGameOver) return;

      // 1. 移動フェーズ開始
      this.isEnemyTurn = true;
      this.events.emit('start-turn'); 
      
      this.time.delayedCall(moveDuration, () => {
        if (this.isGameOver) return;

        // 2. 停止フェーズ開始
        this.isEnemyTurn = false;
        this.events.emit('stop-turn'); 
        
        // 次の停止時間を計算
        const currentStage = this.getCurrentStage();
        
        // 計算式: 1000ms から ステージごとに50ms引く
        // ただし、最低でも 300ms は止まる (人間が反応できる限界として)
        const stopDuration = Math.max(150, 1000 - (currentStage * 80));

        // 次のループへ (計算した停止時間だけ待つ)
        this.time.delayedCall(stopDuration, loopTurn); 
      });
    };

    // 最初は少し待ってから開始
    this.time.delayedCall(500, loopTurn);
  }

update(time: number, delta: number) {
    if (this.isGameOver) return;

    if (this.player) {
      this.player.update(time, delta);
    }

    // 30秒ごとに「基礎難易度」を+1
    this.difficultyTimer += delta;
    if (this.difficultyTimer > 30000) {
        this.baseDifficulty++;
        this.difficultyTimer = 0;
    }

    // ステージ表示の更新
    const currentStage = this.getCurrentStage();
    this.stageText.setText(`STAGE ${currentStage}`);

    // ■■■ Wave生成処理の修正 ■■■
    this.waveTimer += delta;
    if (this.waveTimer > this.nextWaveInterval) {
      // 1. Wave生成
      this.spawnWave(currentStage);
      this.waveTimer = 0;
      
      // 2. 次のWaveまでの間隔を「ターン数」ベースで計算して同期させる
      
      // 現在の停止時間を計算 (startTurnCycleと同じ計算式)
      const currentStopDuration = Math.max(300, 1000 - (currentStage * 50));
      
      // 1ターンの合計時間 (移動2秒 + 停止)
      const oneTurnDuration = 2000 + currentStopDuration;

      // 「何段分空けるか」の設定 (4段進んだら次が来る)
      const gapSteps = 4; 

      // これで「物理的な距離」が常に保たれます
      this.nextWaveInterval = oneTurnDuration * gapSteps;
      
      // デバッグ用ログ（確認したければコメントアウトを外してください）
      // console.log(`Next Wave in: ${this.nextWaveInterval}ms (Stage: ${currentStage}, Stop: ${currentStopDuration}ms)`);
    }
  }
  
  // Wave生成ロジック
  private spawnWave(difficultyLevel: number) {
    const waveRoot = waveConfigData as WaveConfigRoot;
    const enemyRoot = enemyConfigData as EnemyConfigRoot;

    // 現在の難易度以下のWaveを抽出
    const availableWaves = waveRoot.waves.filter(w => w.difficulty <= difficultyLevel);
    
    // データがない場合は「一番簡単なやつ(difficulty=1)」などを候補にする
    let candidates = availableWaves;
    if (candidates.length === 0) {
        candidates = waveRoot.waves.filter(w => w.difficulty === 1);
    }
    // それでもなければ全データから（安全策）
    if (candidates.length === 0) {
        candidates = waveRoot.waves;
    }
    
    const selectedWave = candidates[Phaser.Math.Between(0, candidates.length - 1)];

    if (!selectedWave) return;

    selectedWave.enemies.forEach(def => {
        const enemyConfig = enemyRoot.enemy_types.find(e => e.id === def.type);
        if (enemyConfig) {
            // 1. JSONの座標を「目的地」とする
            const targetPos = GridUtils.gridToPixel(def.gridX, def.gridY);
            
            // 2. 実際の出現位置は、目的地より「10マス上」にする
            // ★修正: 10マス(30秒待ち)は長すぎるので、2マス(6秒待ち)に変更
            // これで「画面のすぐ上」から出現するようになります
            const offsetGrids = 2; 
            const spawnY = targetPos.y - (GridUtils.CELL_SIZE * offsetGrids);

            // 3. 敵を生成 (出現位置 spawnY を指定)
            const enemy = new Enemy(this, targetPos.x, spawnY, enemyConfig);
            
            // 4. ★重要: 目的地（行番号）を敵に覚えさせる
            enemy.destinationRow = def.gridY;

            this.enemies.add(enemy);
            
            if (this.isEnemyTurn) {
                enemy.onStartTurn();
            }
        }
    });
  }

  private handleBulletEnemyCollision(obj1: any, obj2: any) {
    const bullet = obj1 as Bullet;
    const enemy = obj2 as Enemy;

    if (bullet.active && enemy.active) {
      bullet.destroy();
      const isDead = enemy.takeDamage(1);
      
      if (isDead) {
        this.addScore(enemy.scoreValue);

        // アイテムドロップ (10%)
        if (Math.random() < 0.1) { 
           const item = new Item(this, enemy.x, enemy.y);
           this.items.add(item);
           const body = item.body as Phaser.Physics.Arcade.Body;
           if (body) {
             body.setVelocityY(150);
             body.setVelocityX(Phaser.Math.Between(-30, 30));
           }
        }
      }
    }
  }

  // スコア・コンボ計算
  private addScore(basePoint: number) {
    this.combo++;
    if (this.comboTimer) this.comboTimer.remove();

    this.comboTimer = this.time.delayedCall(3000, () => {
        this.combo = 0;
        this.comboText.setText('');
    });

    const bonus = Math.floor(basePoint * (this.combo * 0.1));
    this.score += basePoint + bonus;

    this.scoreText.setText(`SCORE: ${this.score}`);
    
    if (this.combo > 1) {
        this.comboText.setText(`${this.combo} COMBO!`);
        this.tweens.add({
            targets: this.comboText,
            scale: { from: 1.5, to: 1 },
            duration: 200,
            ease: 'Back.out'
        });
    } else {
        this.comboText.setText('');
    }
  }

  private handlePlayerHit(playerObj: any, damageSource: any) {
    if (this.isGameOver) return;
    const player = playerObj as Player;
    
    if (damageSource instanceof Bullet) {
        damageSource.destroy();
    }
    
    player.takeDamage();

    // プレイヤー死亡確認 (hpはPlayer側で管理)
    if (player.hp <= 0) {
        this.gameOver();
    }
  }

  private handlePlayerItemCollision(playerObj: any, itemObj: any) {
    const player = playerObj as Player;
    const item = itemObj as Item;
    item.destroy();
    player.promote();
  }

  // ゲームオーバー処理
  private gameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;

    this.input.setDefaultCursor('default');
    
    this.physics.pause();
    this.time.removeAllEvents();

    if (this.player) {
      this.player.setTint(0xff0000);
    }

    this.createGameOverUI();
  }

  // UI作成メソッド
  private createGameOverUI() {
    const { width, height } = this.scale;

    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    bg.setDepth(100);
    bg.setInteractive(); 

    this.add.text(width / 2, height / 2 - 100, 'GAME OVER', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold',
      fontFamily: 'serif'
    }).setOrigin(0.5).setDepth(101);

    this.add.text(width / 2, height / 2 - 20, `SCORE: ${this.score}`, {
      fontSize: '32px',
      color: '#ffff00',
      fontFamily: 'serif'
    }).setOrigin(0.5).setDepth(101);

    // --- ツイートボタン ---
    const tweetBtn = this.add.text(width / 2, height / 2 + 60, '結果をツイートする', {
      fontSize: '24px',
      color: '#1DA1F2', 
      backgroundColor: '#ffffff',
      padding: { x: 10, y: 10 }
    })
    .setOrigin(0.5)
    .setDepth(101)
    .setInteractive({ useHandCursor: true });

    // スマホ対応のため pointerup
    tweetBtn.on('pointerup', () => {
      this.tweetScore();
    });

    // --- リトライボタン ---
    const retryBtn = this.add.text(width / 2, height / 2 + 130, 'もう一度遊ぶ', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 20, y: 15 }
    })
    .setOrigin(0.5)
    .setDepth(101)
    .setInteractive({ useHandCursor: true });

    retryBtn.on('pointerup', () => {
      this.scene.restart();
    });
  }

  // ■■■ ツイート機能 (更新版) ■■■
  private tweetScore() {
    const text = `将棋シューティングで ${this.score} 点を獲得しました！\n迫りくる将棋の駒を撃ち落とせ！`;
    const hashtags = '将棋シューティング,アプリコンペ';    
    const url = 'https://yas-2024.github.io/shogi-shmup/'; 

    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&hashtags=${hashtags}&url=${encodeURIComponent(url)}`;
    
    window.open(tweetUrl, '_blank');
  }
}