import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import { Item } from '../entities/Item';
import { GridUtils } from '../utils/GridUtils';
import { GameConfig } from '../config/GameConfig';
import { EnemyLogic } from '../utils/EnemyLogic';

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

  // ターン管理ロジック
  private startTurnCycle() {
    const moveDuration = 2000; 

    const loopTurn = () => {
      if (this.isGameOver) return;

      // 1. 移動フェーズ開始
      this.isEnemyTurn = true;
      this.events.emit('start-turn'); 

      // 全敵の移動先を一括決定するロジック
      const enemies = this.enemies.getChildren() as Enemy[];
      enemies.sort((a, b) => b.y - a.y);

      const reservedMap = new Set<string>();
      const moves: { enemy: Enemy, target: {col: number, row: number} }[] = [];

      enemies.forEach(enemy => {
          if (!enemy.active) return;
          const nextGrid = EnemyLogic.decideNextGrid(
              enemy, 
              this.player, 
              enemy.aiProfile, 
              reservedMap
          );
          reservedMap.add(`${nextGrid.col},${nextGrid.row}`);
          moves.push({ enemy, target: nextGrid });
      });

      // 全員一斉に移動開始
      moves.forEach(move => {
          EnemyLogic.executeMove(move.enemy, move.target, move.enemy.speed);
      });

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
    
    // ゲームクリア判定
    if (currentStage >= 15) {
        this.stageText.setText(`STAGE 15`);
        this.gameClear();
        return;
    }

    this.stageText.setText(`STAGE ${currentStage}`);

    this.waveTimer += delta;
    if (this.waveTimer > this.nextWaveInterval) {
      this.spawnWave(currentStage);
      this.waveTimer = 0;
      
      const currentStopDuration = Math.max(300, 1000 - (currentStage * 50));
      const oneTurnDuration = 2000 + currentStopDuration;
      const gapSteps = 3; 
      this.nextWaveInterval = oneTurnDuration * gapSteps;
    }
  }
  
  // ★修正: 難易度順にソートして上位3つから選ぶロジックに変更
  private spawnWave(difficultyLevel: number) {
    const waveRoot = waveConfigData as WaveConfigRoot;
    const enemyRoot = enemyConfigData as EnemyConfigRoot;

    // 1. 現在の難易度以下で出現可能なWaveを全て抽出
    let candidates = waveRoot.waves.filter(w => w.difficulty <= difficultyLevel);
    
    // データがない場合の安全策
    if (candidates.length === 0) {
        candidates = waveRoot.waves.filter(w => w.difficulty === 1);
    }
    if (candidates.length === 0) {
        candidates = waveRoot.waves;
    }
    
    // 2. 難易度が高い順（降順）にソート
    candidates.sort((a, b) => b.difficulty - a.difficulty);

    // 3. 上位3つを抽出（候補が3つ未満なら全部）
    const topCandidates = candidates.slice(0, 3);

    // 4. その中からランダムに1つ選ぶ
    const selectedWave = topCandidates[Phaser.Math.Between(0, topCandidates.length - 1)];

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

  private gameClear() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.input.setDefaultCursor('default');
    
    this.physics.pause();
    this.time.removeAllEvents();

    if (this.player) {
        this.player.setTint(0xffd700); // GOLD Color
    }

    this.createGameClearUI();
  }

  private createGameOverUI() {
    const { width, height } = this.scale;
    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    bg.setDepth(100);
    bg.setInteractive(); 

    this.add.text(width / 2, height / 2 - 100, 'GAME OVER', { fontSize: '48px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'serif' }).setOrigin(0.5).setDepth(101);
    this.add.text(width / 2, height / 2 - 20, `SCORE: ${this.score}`, { fontSize: '32px', color: '#ffff00', fontFamily: 'serif' }).setOrigin(0.5).setDepth(101);

    const tweetBtn = this.add.text(width / 2, height / 2 + 60, '結果をツイートする', { fontSize: '24px', color: '#1DA1F2', backgroundColor: '#ffffff', padding: { x: 10, y: 10 } }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });
    tweetBtn.on('pointerup', () => { this.tweetScore(false); });

    const retryBtn = this.add.text(width / 2, height / 2 + 130, 'もう一度遊ぶ', { fontSize: '24px', color: '#ffffff', backgroundColor: '#333333', padding: { x: 20, y: 15 } }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });
    retryBtn.on('pointerup', () => { this.scene.restart(); });
  }

  private createGameClearUI() {
    const { width, height } = this.scale;
    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    bg.setDepth(100);
    bg.setInteractive(); 

    this.add.text(width / 2, height / 2 - 100, 'GAME CLEAR!!', { 
        fontSize: '48px', 
        color: '#ffff00', 
        fontStyle: 'bold', 
        fontFamily: 'serif',
        stroke: '#ff0000',
        strokeThickness: 4
    }).setOrigin(0.5).setDepth(101);

    this.add.text(width / 2, height / 2 - 20, `SCORE: ${this.score}`, { fontSize: '32px', color: '#ffffff', fontFamily: 'serif' }).setOrigin(0.5).setDepth(101);

    const tweetBtn = this.add.text(width / 2, height / 2 + 60, 'クリアを自慢する', { 
        fontSize: '24px', color: '#1DA1F2', backgroundColor: '#ffffff', padding: { x: 10, y: 10 } 
    }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });
    
    tweetBtn.on('pointerup', () => { this.tweetScore(true); });

    const retryBtn = this.add.text(width / 2, height / 2 + 130, 'もう一度遊ぶ', { 
        fontSize: '24px', color: '#ffffff', backgroundColor: '#333333', padding: { x: 20, y: 15 } 
    }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });
    retryBtn.on('pointerup', () => { this.scene.restart(); });
  }

  private tweetScore(isClear: boolean = false) {
    let text = '';
    if (isClear) {
        text = `将棋×STGを完全クリアしました！(SCORE: ${this.score})\n君は15ステージの猛攻に耐えられるか！？`;
    } else {
        text = `将棋×STGで ${this.score} 点を獲得しました！(STAGE ${this.getCurrentStage()})\n迫りくる将棋の駒を撃ち落とせ！`;
    }
    
    const hashtags = '将棋×STG,アプリコンペ';    
    const url = 'https://yas-2024.github.io/shogi-shmup/'; 
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&hashtags=${hashtags}&url=${encodeURIComponent(url)}`;
    window.open(tweetUrl, '_blank');
  }
}