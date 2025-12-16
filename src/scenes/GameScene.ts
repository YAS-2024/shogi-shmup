import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import { Item } from '../entities/Item';
import { GridUtils } from '../utils/GridUtils'; // ★追加
import { GameConfig } from '../config/GameConfig'; // ★追加

// データ
import enemyConfigData from '../config/enemy_config.json';
import waveConfigData from '../config/wave_config.json';
import type { EnemyConfigRoot, WaveConfigRoot} from '../types/ConfigTypes';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;      
  private enemyBullets!: Phaser.Physics.Arcade.Group; 
  private items!: Phaser.Physics.Arcade.Group;        
  
  // ★Wave管理用
  private waveTimer: number = 0;
  private nextWaveInterval: number = 4000; // 初回は4秒間隔
  private currentDifficulty: number = 1;   // 現在の難易度レベル
  
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
    
    // Wave初期化
    this.waveTimer = 0;
    this.nextWaveInterval = 4000;
    this.currentDifficulty = 1;

    this.cameras.main.setBackgroundColor(GameConfig.BG_COLOR || '#444444');

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

    this.input.setDefaultCursor('none');

    // ターン制サイクルの開始
    this.startTurnCycle();
  }

  // ターン管理ロジック (2秒動く -> 1秒止まる)
  private startTurnCycle() {
    const moveDuration = 2000;
    const stopDuration = 1000;

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
        
        // 次のループへ
        this.time.delayedCall(stopDuration, loopTurn); 
      });
    };

    this.time.delayedCall(1000, loopTurn);
  }

  update(time: number, delta: number) {
    if (this.isGameOver) return;

    if (this.player) {
      this.player.update(time, delta);
    }

    // ★Wave管理: タイマーを進めて一定時間ごとに敵グループを出現させる
    this.waveTimer += delta;
    if (this.waveTimer > this.nextWaveInterval) {
      this.spawnWave();
      this.waveTimer = 0;
      
      // 徐々に難易度を上げ、間隔を短くする (最短1.5秒まで)
      this.nextWaveInterval = Math.max(1500, this.nextWaveInterval - 100);
      if (this.score > this.currentDifficulty * 2000) {
          this.currentDifficulty++; // スコアに応じて難易度Lvアップ
      }
    }
  }

  // ★Wave生成ロジック
  private spawnWave() {
    const waveRoot = waveConfigData as WaveConfigRoot;
    const enemyRoot = enemyConfigData as EnemyConfigRoot;

    // 現在の難易度以下のWaveを抽出
    // (序盤は簡単なパターンのみ、終盤は難しいパターンも含めてランダム)
    const availableWaves = waveRoot.waves.filter(w => w.difficulty <= this.currentDifficulty);
    
    // データがない場合は全データから選ぶ（安全策）
    const candidates = availableWaves.length > 0 ? availableWaves : waveRoot.waves;
    
    // ランダムに1つWaveパターンを選択
    const selectedWave = candidates[Phaser.Math.Between(0, candidates.length - 1)];

    if (!selectedWave) return;

    // Wave内の敵定義をループして生成
    selectedWave.enemies.forEach(def => {
        // IDから敵の基本設定を取得
        const enemyConfig = enemyRoot.enemy_types.find(e => e.id === def.type);
        if (enemyConfig) {
            // Grid座標 -> Pixel座標変換
            // ※Wave定義のY座標は画面外(マイナス)から始まることが多い
            //   ここではそのままGridUtilsに通して配置位置を決めます
            const pos = GridUtils.gridToPixel(def.gridX, def.gridY);
            
            // 画面上部に見切れすぎないよう、あまりに上なら補正しても良いですが
            // 今回は一旦そのまま配置します
            const enemy = new Enemy(this, pos.x, pos.y, enemyConfig);
            this.enemies.add(enemy);

            // もし現在「移動ターン」中なら、出現と同時に動かす
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

        // アイテムドロップ (10%の確率に変更)
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
    
    // 弾なら消す
    if (damageSource instanceof Bullet) {
        damageSource.destroy();
    }
    // 敵本体なら、敵も消滅するかどうかはゲームデザイン次第ですが
    // ここでは敵は残る（プレイヤーだけダメージ）とします
    
    player.takeDamage();

    // プレイヤー死亡確認
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

  // ■■■ ゲームオーバー処理 ■■■
  private gameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;

    // カーソルを戻す
    this.input.setDefaultCursor('default');
    
    // 物理演算停止
    this.physics.pause();
    this.time.removeAllEvents(); // タイマー系全停止

    // プレイヤーを赤くする
    if (this.player) {
      this.player.setTint(0xff0000);
    }

    // UI作成
    this.createGameOverUI();
  }

  // ■■■ UI作成メソッド ■■■
  private createGameOverUI() {
    const { width, height } = this.scale;

    // 半透明の黒背景
    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    bg.setDepth(100);

    // "GAME OVER" テキスト
    this.add.text(width / 2, height / 2 - 100, 'GAME OVER', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold',
      fontFamily: 'serif'
    }).setOrigin(0.5).setDepth(101);

    // スコア表示
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
      padding: { x: 10, y: 5 }
    })
    .setOrigin(0.5)
    .setDepth(101)
    .setInteractive({ useHandCursor: true });

    tweetBtn.on('pointerdown', () => {
      this.tweetScore();
    });

    // --- リトライボタン ---
    const retryBtn = this.add.text(width / 2, height / 2 + 130, 'もう一度遊ぶ', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 20, y: 10 }
    })
    .setOrigin(0.5)
    .setDepth(101)
    .setInteractive({ useHandCursor: true });

    retryBtn.on('pointerdown', () => {
      this.scene.restart();
    });
  }

  // ■■■ ツイート機能 ■■■
  private tweetScore() {
    const text = `将棋シューティングで ${this.score} 点を獲得しました！\n迫りくる将棋の駒を撃ち落とせ！`;
    const hashtags = '将棋シューティング,Phaser3,個人開発';
    // ※公開時は実際のURLを入れてください
    const url = 'https://example.com'; 

    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&hashtags=${hashtags}&url=${encodeURIComponent(url)}`;
    
    window.open(tweetUrl, '_blank');
  }
}