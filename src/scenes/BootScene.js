export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Load assets here later (images, audio, etc.)
    // For now we use placeholder shapes so nothing to load
  }

  create() {
    // Jump straight to menu once loading is done
    this.scene.start('MenuScene');
  }
}
