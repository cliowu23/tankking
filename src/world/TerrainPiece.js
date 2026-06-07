export default class TerrainPiece {
  constructor(scene, x, y, width, topDepth, frontHeight,
              topColor = 0xd4b98a, frontColor = 0x8a6a3c) {
    this.bottomY = y + topDepth / 2;
    this.frontEdgeY = this.bottomY + frontHeight;

    this.topRect = scene.add.rectangle(x, y, width, topDepth, topColor);
    scene.physics.add.existing(this.topRect, true);
    this.topRect.body.setSize(width, topDepth, true);
    this.topRect.setDepth(this.bottomY - 1);

    this.frontGraphics = scene.add.graphics();
    this.frontGraphics.fillStyle(frontColor);
    this.frontGraphics.fillRect(x - width / 2, this.bottomY, width, frontHeight);
    this.frontGraphics.lineStyle(1, Math.max(0, frontColor - 0x101010));
    this.frontGraphics.strokeRect(x - width / 2, this.bottomY, width, frontHeight);
    this.frontGraphics.setDepth(this.frontEdgeY);
  }
}
