import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import { Item } from '../entities/Item'; // ★追加: アイテムクラス
import enemyConfigData from '../config/enemy_config.json';
import type { EnemyConfigRoot } from '../types/ConfigTypes';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;      // 自機の弾
  private enemyBullets!: Phaser.Physics.Arcade.Group; // 敵の弾
  private items!: Phaser.Physics.Arcade.Group;        // ★追加: アイテムグループ
  
  private spawnTimer: number = 0;
  private isGameOver: boolean = false;

  constructor() {
    super('GameScene');
  }

  create() {
    this.isGameOver = false;
    this.cameras.main.setBackgroundColor('#444444');

    // ★爆発用パーティクルのテクスチャを生成
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffaa00, 1); // オレンジ色
    graphics.fillCircle(4, 4, 4);    // 半径4pxの円
    graphics.generateTexture('flare', 8, 8);
    graphics.destroy();

    // 1. グループ初期化
    this.bullets = this.physics.add.group({
      classType: Bullet,
      runChildUpdate: true
    });
    
    this.enemyBullets = this.physics.add.group({
      classType: Bullet,
      runChildUpdate: true
    });

    this.enemies = this.physics.add.group({
      classType: Enemy,
      runChildUpdate: true
    });

    // ★追加: アイテムグループの初期化
    this.items = this.physics.add.group({
      classType: Item,
      runChildUpdate: true
    });

    // 2. 自機生成
    const { width, height } = this.scale;
    this.player = new Player(this, width / 2, height - 100, this.bullets);

    // 3. 衝突判定設定
    // A: 自機の弾 vs 敵
    this.physics.add.overlap(
      this.bullets, 
      this.enemies, 
      this.handleBulletEnemyCollision, 
      undefined, 
      this
    );

    // B: 敵 vs 自機 (体当たり)
    this.physics.add.overlap(
      this.enemies, 
      this.player, 
      this.handlePlayerHit, 
      undefined, 
      this
    );

    // C: 敵の弾 vs 自機
    this.physics.add.overlap(
      this.enemyBullets, 
      this.player, 
      this.handlePlayerHit, 
      undefined, 
      this
    );

    // ★追加 D: 自機 vs アイテム
    this.physics.add.overlap(
      this.player, 
      this.items, 
      this.handlePlayerItemCollision, 
      undefined, 
      this
    );

    // 4. イベントリスナー
    this.events.on('game-over', this.handleGameOver, this);

    this.input.setDefaultCursor('none');
  }

  update(time: number, delta: number) {
    if (this.isGameOver) return;

    if (this.player) {
      this.player.update(time, delta);
    }

    // 敵のスポーン処理
    this.spawnTimer += delta;
    if (this.spawnTimer > 1000) {
      this.spawnTestEnemy();
      this.spawnTimer = 0;
    }
  }

  private spawnTestEnemy() {
    const configRoot = enemyConfigData as EnemyConfigRoot;
    const enemyData = configRoot.enemy_types.find(e => e.id === 'ENEMY_FU');
    
    if (enemyData) {
      const x = Phaser.Math.Between(50, this.scale.width - 50);
      const enemy = new Enemy(this, x, -50, enemyData);
      this.enemies.add(enemy);
    }
  }

// 敵撃破時の処理
  private handleBulletEnemyCollision(obj1: any, obj2: any) {
    const bullet = obj1 as Bullet;
    const enemy = obj2 as Enemy;

    if (bullet.active && enemy.active) {
      bullet.destroy();
      const isDead = enemy.takeDamage(1);
      
      if (isDead) {
        // ★確率でアイテムドロップ
        if (Math.random() > 0.5) { 
           const item = new Item(this, enemy.x, enemy.y);
           this.items.add(item);
           
           // ★★★ 修正: ここで速度を再設定する（念押し） ★★★
           const body = item.body as Phaser.Physics.Arcade.Body;
           if (body) {
             body.setVelocityY(150);            // 下へ落ちる
             body.setVelocityX(Phaser.Math.Between(-30, 30)); // 横へ散らす
           }
        }
      }
    }
  }

  // 自機がダメージを受けたときの処理
  private handlePlayerHit(playerObj: any, damageSource: any) {
    if (this.isGameOver) return;

    const player = playerObj as Player;
    
    // 弾なら消す
    if (damageSource instanceof Bullet) {
        damageSource.destroy();
    }

    // プレイヤーにダメージ通知
    player.takeDamage();
  }

  // ★追加: アイテム取得時の処理
  private handlePlayerItemCollision(playerObj: any, itemObj: any) {
    const player = playerObj as Player;
    const item = itemObj as Item;

    // アイテムを消す
    item.destroy();

    // 自機を進化させる
    player.promote();
  }

  // ゲームオーバー時の処理
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