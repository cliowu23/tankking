export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.text(cx, cy - 60, 'TanKING', {
      fontSize: '48px',
      color: '#cccccc',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    const startText = this.add.text(cx, cy + 40, 'PRESS ENTER TO START', {
      fontSize: '20px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Blink the prompt
    this.tweens.add({
      targets: startText,
      alpha: 0,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    this.input.keyboard.once('keydown-ENTER', () => {
      this.scene.start('ArenaScene');
    });
  }
}
