import Phaser from 'phaser';

export class Bullet extends Phaser.GameObjects.Rectangle {
  private speedX: number;
  private speedY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, angle: number, speed: number) {
    // 弾の見た目: 幅4px, 高さ10px, 黄色っぽい色
    super(scene, x, y, 4, 10, 0xffff00);
    scene.add.existing(this);
    
    // 物理演算（重力なし）を有効化
    scene.physics.add.existing(this);

    // 角度から速度ベクトルを計算 (Phaserの角度は時計回り。0度が右、-90が上)
    // 今回の設定ファイルでは 0度=真上 と定義したので、変換が必要です。
    // 設定ファイルの 0度(真上) -> Phaserの -90度
    const phaserAngle = angle - 90;
    
    const rad = Phaser.Math.DegToRad(phaserAngle);
    this.speedX = Math.cos(rad) * speed;
    this.speedY = Math.sin(rad) * speed;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;

    // 画面外に出たら消す (メモリ節約)
    if (this.y < -50 || this.y > this.scene.scale.height + 50 ||
        this.x < -50 || this.x > this.scene.scale.width + 50) {
      this.destroy();
    }
  }
}