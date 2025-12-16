import Phaser from 'phaser';

export class Item extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 1. 形状: 金色の将棋の駒
    const shapePoints = [0, -20, 15, -10, 10, 20, -10, 20, -15, -10];
    const shape = scene.add.polygon(0, 0, shapePoints, 0xffd700); // ゴールド
    shape.setStrokeStyle(2, 0xffffff); // 白い枠
    this.add(shape);

    // 2. 文字: "成"
    const label = scene.add.text(-15, -15, '成', {
      fontSize: '18px',
      color: '#000000',
      fontFamily: 'serif',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add(label);

// 3. 物理設定
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(30, 40);
    
    // ★追加: 判定の中心を画像の中心に合わせる (幅30, 高さ40の半分ずつずらす)
    body.setOffset(-30, -40);
    
    // 速度設定
    body.setVelocityY(150); 
    body.setVelocityX(Phaser.Math.Between(-30, 30));
    
    // ★少しだけ左右にランダムに散らばらせる演出 (-30 〜 30)
    body.setVelocityX(Phaser.Math.Between(-30, 30));
  }

  update() {
    // 画面の下端 (+50px余裕を見て) を超えたら消滅させる
    if (this.y > this.scene.scale.height + 50) {
      this.destroy();
    }
  }
}