export default class HangarScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HangarScene' });
  }

  create() {
    // Placeholder — the hangar hub comes after the vertical slice
    this.add.text(40, 40, 'HANGAR — Coming soon', {
      fontSize: '24px',
      color: '#888888',
      fontFamily: 'monospace',
    });
  }
}
