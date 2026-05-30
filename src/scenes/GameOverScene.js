export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.text(cx, cy - 40, 'TANK DESTROYED', {
      fontSize: '40px',
      color: '#cc4444',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 40, 'PRESS ENTER TO RETRY', {
      fontSize: '20px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-ENTER', () => {
      this.scene.start('ArenaScene');
    });
  }
}
