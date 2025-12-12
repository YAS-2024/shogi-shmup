// src/scenes/GameScene.ts

import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import enemyConfigData from '../config/enemy_config.json';
import type { EnemyConfigRoot } from '../types/ConfigTypes';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;      // 自機の弾
  private enemyBullets!: Phaser.Physics.Arcade.Group; // ★追加: 敵の弾
  
  private spawnTimer: number = 0;
  private isGameOver: boolean = false; // ★追加: ゲームオーバーフラグ

  constructor() {
    super('GameScene');
  }

 create() {
    this.isGameOver = false;
    this.cameras.main.setBackgroundColor('#444444');

    // ★★★ 追加: 爆発用パーティクルのテクスチャを生成 ★★★
    // 小さな黄色い丸を作って 'flare' という名前でメモリに登録します
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffaa00, 1); // オレンジ色
    graphics.fillCircle(4, 4, 4);    // 半径4pxの円
    graphics.generateTexture('flare', 8, 8); // テクスチャ化
    graphics.destroy(); // 元のgraphicsは不要なので削除
    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
    
    // 1. グループ初期化
    this.bullets = this.physics.add.group({
      classType: Bullet,
      runChildUpdate: true
    });
    
    // ★追加: 敵の弾グループ
    this.enemyBullets = this.physics.add.group({
      classType: Bullet,
      runChildUpdate: true
    });

    this.enemies = this.physics.add.group({
      classType: Enemy,
      runChildUpdate: true
    });

    // 2. 自機生成
    const { width, height } = this.scale;
    this.player = new Player(this, width / 2, height - 100, this.bullets);

    // 3. 衝突判定設定
    // A: 自機の弾 vs 敵 (既存)
    this.physics.add.overlap(this.bullets, this.enemies, this.handleBulletEnemyCollision, undefined, this);

    // ★追加 B: 敵 vs 自機 (体当たり)
    this.physics.add.overlap(this.enemies, this.player, this.handlePlayerHit, undefined, this);

    // ★追加 C: 敵の弾 vs 自機
    this.physics.add.overlap(this.enemyBullets, this.player, this.handlePlayerHit, undefined, this);

    // 4. イベントリスナー (ゲームオーバー通知を受け取る)
    this.events.on('game-over', this.handleGameOver, this);

    this.input.setDefaultCursor('none');
  }

  update(time: number, delta: number) {
    // ★ゲームオーバーなら更新を止める（敵のスポーンなどを停止）
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
    const enemyData = configRoot.enemy_types.find(e => e.id === 'ENEMY_FU');
    if (enemyData) {
      const x = Phaser.Math.Between(50, this.scale.width - 50);
      const enemy = new Enemy(this, x, -50, enemyData);
      this.enemies.add(enemy);
    }
  }

  private handleBulletEnemyCollision(obj1: any, obj2: any) {
    const bullet = obj1 as Bullet;
    const enemy = obj2 as Enemy;
    if (bullet.active && enemy.active) {
      bullet.destroy();
      const isDead = enemy.takeDamage(1);
      if (isDead) {
        console.log(`Enemy defeated! Score: ${enemy.scoreValue}`);
      }
    }
  }

  // ★追加: プレイヤーがダメージを受けたときの処理
  // (敵本体との衝突、または敵弾との衝突で呼ばれる)
  private handlePlayerHit(playerObj: any, damageSource: any) {
    // 既にゲームオーバーなら無視
    if (this.isGameOver) return;

    const player = playerObj as Player;
    
    // 衝突相手が「敵の弾」なら消す。「敵本体」なら消さない（あるいは敵もダメージ受ける？）
    // 今回は「敵の弾」かどうか判定して消す
    if (damageSource instanceof Bullet) {
        damageSource.destroy();
    } else {
        // 敵本体とぶつかった場合、敵も破壊するか、そのままにするか。
        // 一般的には敵も破壊することが多いですが、一旦そのままで。
    }

    // プレイヤーにダメージ通知
    player.takeDamage();
  }

  // ★追加: ゲームオーバー時の処理
  private handleGameOver() {
    this.isGameOver = true;
    this.input.setDefaultCursor('default'); // カーソルを戻す

    // 物理演算を止める
    this.physics.pause();

    // 画面中央にテキスト表示
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

    // クリックでリスタート
    this.input.once('pointerdown', () => {
      this.events.off('game-over'); // リスナー解除
      this.scene.restart();
    });
  }
}