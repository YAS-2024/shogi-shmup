import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import { Item } from '../entities/Item';
import { GridUtils } from '../utils/GridUtils';
import { GameConfig } from '../config/GameConfig';
import { EnemyLogic } from '../utils/EnemyLogic'; // ★追加

import enemyConfigData from '../config/enemy_config.json';
import waveConfigData from '../config/wave_config.json';
import type { EnemyConfigRoot, WaveConfigRoot } from '../types/ConfigTypes';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;      
  private enemyBullets!: Phaser.Physics.Arcade.Group; 
  private items!: Phaser.Physics.Arcade.Group;        
  
  private waveTimer: number = 0;
  private nextWaveInterval: number = 4000;
  
  private baseDifficulty: number = 0; 
  private difficultyTimer: number = 0;
  private stageText!: Phaser.GameObjects.Text;
  
  private isGameOver: boolean = false;
  private score: number = 0;
  private combo: number = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private comboTimer?: Phaser.Time.TimerEvent;

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
    this.baseDifficulty = 0;
    this.difficultyTimer = 0;

    this.cameras.main.setBackgroundColor(GameConfig.BG_COLOR || '#444444');

    // UI設定
    this.scoreText = this.add.text(20, 20, 'SCORE: 0', { fontSize: '28px', color: '#ffffff', fontFamily: 'monospace' }).setDepth(100);
    this.stageText = this.add.text(this.scale.width - 20, 20, 'STAGE 1', { fontSize: '28px', color: '#ffffff', fontFamily: 'monospace', align: 'right' }).setOrigin(1, 0).setDepth(100);
    this.comboText = this.add.text(20, 55, '', { fontSize: '24px', color: '#ffff00', fontStyle: 'bold', fontFamily: 'monospace' }).setDepth(100);

    // グループ初期化
    this.bullets = this.physics.add.group({ classType: Bullet, runChildUpdate: true });
    this.enemyBullets = this.physics.add.group({ classType: Bullet, runChildUpdate: true });
    this.enemies = this.physics.add.group({ classType: Enemy, runChildUpdate: true });
    this.items = this.physics.add.group({ classType: Item, runChildUpdate: true });

    // 自機生成
    const { width, height } = this.scale;
    this.player = new Player(this, width / 2, height * 0.8, this.bullets);

    // 衝突判定
    this.physics.add.overlap(this.bullets, this.enemies, this.handleBulletEnemyCollision, undefined, this);
    this.physics.add.overlap(this.enemies, this.player, this.handlePlayerHit, undefined, this);
    this.physics.add.overlap(this.enemyBullets, this.player, this.handlePlayerHit, undefined, this);
    this.physics.add.overlap(this.player, this.items, this.handlePlayerItemCollision, undefined, this);

    this.input.setDefaultCursor('none');

    this.startTurnCycle();
  }

  private getCurrentStage(): number {
    const playerRank = this.player ? this.player.currentRank : 0;
    return playerRank + this.baseDifficulty + 1;
  }

  // ★修正: ターン管理ロジック (敵の連携移動)
  private startTurnCycle() {
    const moveDuration = 2000; 

    const loopTurn = () => {
      if (this.isGameOver) return;

      // 1. 移動フェーズ開始
      this.isEnemyTurn = true;
      this.events.emit('start-turn'); // アニメーション開始トリガー等用

      // ■■■ 全敵の移動先を一括決定するロジック ■■■
      
      // (1) 現在画面にいる敵を取得
      const enemies = this.enemies.getChildren() as Enemy[];

      // (2) 「下側の駒」から順に処理したいので、Y座標が大きい順(降順)にソート
      // 前線の駒が先に場所を決め、後続の駒はその空いた場所を使えるようになる
      enemies.sort((a, b) => b.y - a.y);

      // (3) 移動先予約マップ (key: "col,row")
      const reservedMap = new Set<string>();

      // (4) 各敵の移動先を決定
      const moves: { enemy: Enemy, target: {col: number, row: number} }[] = [];

      enemies.forEach(enemy => {
          if (!enemy.active) return;

          // EnemyLogicに「予約状況」を渡して、空いているベストな場所を聞く
          // Enemy.tsで aiProfile を public にしたのでアクセス可能
          const nextGrid = EnemyLogic.decideNextGrid(
              enemy, 
              this.player, 
              enemy.aiProfile, 
              reservedMap
          );

          // 自分の行き先を予約台帳に書き込む
          reservedMap.add(`${nextGrid.col},${nextGrid.row}`);

          // 命令リストに追加
          moves.push({ enemy, target: nextGrid });
      });

      // (5) 全員一斉に移動開始
      moves.forEach(move => {
          EnemyLogic.executeMove(move.enemy, move.target, move.enemy.speed);
      });

      // ■■■■■■■■■■■■■■■■■■■■■■■■■■

      this.time.delayedCall(moveDuration, () => {
        if (this.isGameOver) return;

        // 2. 停止フェーズ開始
        this.isEnemyTurn = false;
        this.events.emit('stop-turn'); 
        
        const currentStage = this.getCurrentStage();
        const stopDuration = Math.max(150, 1000 - (currentStage * 80));

        this.time.delayedCall(stopDuration, loopTurn); 
      });
    };

    this.time.delayedCall(500, loopTurn);
  }

  update(time: number, delta: number) {
    if (this.isGameOver) return;

    if (this.player) {
      this.player.update(time, delta);
    }

    this.difficultyTimer += delta;
    if (this.difficultyTimer > 30000) {
        this.baseDifficulty++;
        this.difficultyTimer = 0;
    }

    const currentStage = this.getCurrentStage();
    this.stageText.setText(`STAGE ${currentStage}`);

    this.waveTimer += delta;
    if (this.waveTimer > this.nextWaveInterval) {
      this.spawnWave(currentStage);
      this.waveTimer = 0;
      
      const currentStopDuration = Math.max(300, 1000 - (currentStage * 50));
      const oneTurnDuration = 2000 + currentStopDuration;
      const gapSteps = 5; 
      this.nextWaveInterval = oneTurnDuration * gapSteps;
    }
  }
  
  private spawnWave(difficultyLevel: number) {
    const waveRoot = waveConfigData as WaveConfigRoot;
    const enemyRoot = enemyConfigData as EnemyConfigRoot;

    const availableWaves = waveRoot.waves.filter(w => w.difficulty <= difficultyLevel);
    let candidates = availableWaves;
    if (candidates.length === 0) candidates = waveRoot.waves.filter(w => w.difficulty === 1);
    if (candidates.length === 0) candidates = waveRoot.waves;
    
    const selectedWave = candidates[Phaser.Math.Between(0, candidates.length - 1)];

    if (!selectedWave) return;

    selectedWave.enemies.forEach(def => {
        const enemyConfig = enemyRoot.enemy_types.find(e => e.id === def.type);
        if (enemyConfig) {
            const targetPos = GridUtils.gridToPixel(def.gridX, def.gridY);
            
            const offsetGrids = 2; 
            const spawnY = targetPos.y - (GridUtils.CELL_SIZE * offsetGrids);

            const enemy = new Enemy(this, targetPos.x, spawnY, enemyConfig);
            enemy.destinationRow = def.gridY;

            this.enemies.add(enemy);
            
            // isEnemyTurnのチェックは削除（GameSceneの一斉管理に任せるため）
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

  private createGameOverUI() {
    const { width, height } = this.scale;
    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    bg.setDepth(100);
    bg.setInteractive(); 

    this.add.text(width / 2, height / 2 - 100, 'GAME OVER', { fontSize: '48px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'serif' }).setOrigin(0.5).setDepth(101);
    this.add.text(width / 2, height / 2 - 20, `SCORE: ${this.score}`, { fontSize: '32px', color: '#ffff00', fontFamily: 'serif' }).setOrigin(0.5).setDepth(101);

    const tweetBtn = this.add.text(width / 2, height / 2 + 60, '結果をツイートする', { fontSize: '24px', color: '#1DA1F2', backgroundColor: '#ffffff', padding: { x: 10, y: 10 } }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });
    tweetBtn.on('pointerup', () => { this.tweetScore(); });

    const retryBtn = this.add.text(width / 2, height / 2 + 130, 'もう一度遊ぶ', { fontSize: '24px', color: '#ffffff', backgroundColor: '#333333', padding: { x: 20, y: 15 } }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });
    retryBtn.on('pointerup', () => { this.scene.restart(); });
  }

  private tweetScore() {
    const text = `将棋シューティングで ${this.score} 点を獲得しました！\n迫りくる将棋の駒を撃ち落とせ！`;
    const hashtags = '将棋シューティング,アプリコンペ';    
    const url = 'https://yas-2024.github.io/shogi-shmup/'; 
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&hashtags=${hashtags}&url=${encodeURIComponent(url)}`;
    window.open(tweetUrl, '_blank');
  }
}