import Phaser from 'phaser';
import type { EnemyConfig } from '../types/ConfigTypes';

export class Enemy extends Phaser.GameObjects.Container {
  public hp: number;
  public scoreValue: number;
  private speed: number;
  private bodyShape: Phaser.GameObjects.Polygon;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemyConfig) {
    super(scene, x, y);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.hp = config.hp;
    this.scoreValue = config.score;
    this.speed = config.speed;

    // 1. 形状: 「普通の向き（上向き）」で作ります
    // （コンテナごと回転させるので、作るときは素直な向きでOKです）
    const shapePoints = [
      0, -30,   // 上
      20, -10,  // 右上
      15, 25,   // 右下
      -15, 25,  // 左下
      -20, -10  // 左上
    ];
    this.bodyShape = scene.add.polygon(0, 0, shapePoints, 0x8b4513);
    this.bodyShape.setStrokeStyle(2, 0xdeb887);
    this.add(this.bodyShape);

    // 2. 文字: 中心(0,0)に配置。回転はコンテナに任せるので文字自体の回転は不要。
    const displayName = config.name.replace('敵', '').substring(0, 1);
    this.label = scene.add.text(-20, -20, displayName, { // 位置微調整 (-5)
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'serif'
    }).setOrigin(0.5);
    this.add(this.label);

    // 3. コンテナ全体を180度回転（これで見た目は完璧なはず）
    this.setRotation(Math.PI);

    // 4. 当たり判定サイズ
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(40, 50);
    // ★重要: オフセットは一切設定しない（デフォルトのまま）
    // updateメソッドでの強制上書きで制御するため
  }
  update(_time: number, delta: number) {
    // 移動
    this.y += this.speed * (delta / 1000);

    // ★★★ 物理ボディの位置合わせ (シンプル・イズ・ベスト) ★★★
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      // 難しい計算は無し。「コンテナの今の中心座標」から「半分のサイズ」を引けば
      // 絶対にヒットボックスの左上は正しい位置に来ます。
      // Arcade Physicsの箱は回転しないので、これで常に真ん中です。
      body.x = this.x - (body.width / 2);
      body.y = this.y - (body.height / 2);
    }

    // 画面外削除
    if (this.y > this.scene.scale.height + 50) {
      this.destroy();
    }
  }

  public takeDamage(amount: number): boolean {
    this.hp -= amount;
    if (this.hp <= 0) {
        this.scene.tweens.add({
            targets: this, alpha: 0, scale: 1.5, duration: 100, onComplete: () => this.destroy()
        });
        return true;
    }
    return false;
  }
}