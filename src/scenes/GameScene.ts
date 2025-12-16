import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import { Item } from '../entities/Item';
import enemyConfigData from '../config/enemy_config.json';
import type { EnemyConfigRoot } from '../types/ConfigTypes';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;      
  private enemyBullets!: Phaser.Physics.Arcade.Group; 
  private items!: Phaser.Physics.Arcade.Group;        
  
  private spawnTimer: number = 0;
  private isGameOver: boolean = false;

  // スコア・コンボ関連
  private score: number = 0;
  private combo: number = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private comboTimer?: Phaser.Time.TimerEvent;

  // ★ターン管理用
  private isEnemyTurn: boolean = false;

  constructor() {
    super('GameScene');
  }

  create() {
    this.isGameOver = false;
    this.score = 0;
    this.combo = 0;
    this.isEnemyTurn = false; // 初期化

    this.cameras.main.setBackgroundColor('#444444');

    // 爆発用テクスチャ生成
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffaa00, 1);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture('flare', 8, 8);
    graphics.destroy();

    // UI設定
    this.scoreText = this.add.text(20, 20, 'SCORE: 0', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setDepth(100);

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
    this.player = new Player(this, width / 2, height - 100, this.bullets);

    // 衝突判定
    this.physics.add.overlap(this.bullets, this.enemies, this.handleBulletEnemyCollision, undefined, this);
    this.physics.add.overlap(this.enemies, this.player, this.handlePlayerHit, undefined, this);
    this.physics.add.overlap(this.enemyBullets, this.player, this.handlePlayerHit, undefined, this);
    this.physics.add.overlap(this.player, this.items, this.handlePlayerItemCollision, undefined, this);

    this.events.on('game-over', this.handleGameOver, this);
    this.input.setDefaultCursor('none');

    // ★ターン制サイクルの開始
    this.startTurnCycle();
  }

  // ★追加: ターン管理ロジック (2秒動く -> 1秒止まる)
  private startTurnCycle() {
    const moveDuration = 2000; // 2秒動く
    const stopDuration = 1000; // 1秒止まる

    const loopTurn = () => {
      if (this.isGameOver) return; // ゲームオーバーなら停止

      // 1. 移動フェーズ開始
      this.isEnemyTurn = true;
      this.events.emit('start-turn'); 
      
      this.time.delayedCall(moveDuration, () => {
        if (this.isGameOver) return;

        // 2. 停止フェーズ開始
        this.isEnemyTurn = false;
        this.events.emit('stop-turn'); 
        
        // 次のループへ
        this.time.delayedCall(stopDuration, loopTurn); 
      });
    };

    // 最初は少し待ってから開始
    this.time.delayedCall(1000, loopTurn);
  }

  update(time: number, delta: number) {
    if (this.isGameOver) return;

    if (this.player) {
      this.player.update(time, delta);
    }

    this.spawnTimer += delta;
    if (this.spawnTimer > 1000) {
      this.spawnTestEnemy();
      this.spawnTimer = 0;
    }
  }

  private spawnTestEnemy() {
    const configRoot = enemyConfigData as EnemyConfigRoot;
    
    // ★ランダムな敵タイプを選択
    const types = configRoot.enemy_types;
    if (!types || types.length === 0) return;

    const randomType = types[Phaser.Math.Between(0, types.length - 1)];

    if (randomType) {
      const x = Phaser.Math.Between(50, this.scale.width - 50);
      const enemy = new Enemy(this, x, -50, randomType);
      this.enemies.add(enemy);

      // ★もし現在「移動ターン」中なら、出現と同時に動かす
      if (this.isEnemyTurn) {
         enemy.onStartTurn(); 
      }
    }
  }

  private handleBulletEnemyCollision(obj1: any, obj2: any) {
    const bullet = obj1 as Bullet;
    const enemy = obj2 as Enemy;

    if (bullet.active && enemy.active) {
      bullet.destroy();
      const isDead = enemy.takeDamage(1);
      
      if (isDead) {
        // スコア加算
        this.addScore(enemy.scoreValue);

        // アイテムドロップ (50%)
        if (Math.random() > 0.5) { 
           const item = new Item(this, enemy.x, enemy.y);
           this.items.add(item);
           // 物理設定の再適用
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
    if (damageSource instanceof Bullet) damageSource.destroy();
    player.takeDamage();
  }

  private handlePlayerItemCollision(playerObj: any, itemObj: any) {
    const player = playerObj as Player;
    const item = itemObj as Item;
    item.destroy();
    player.promote();
  }

  private handleGameOver() {
    this.isGameOver = true;
    this.input.setDefaultCursor('default');
    this.physics.pause();

    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2, 'GAME OVER', {
      fontSize: '64px',
      color: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 80, 'Click to Restart', {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.input.once('pointerdown', () => {
      this.events.off('game-over');
      this.scene.restart();
    });
  }
}