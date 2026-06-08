// Painted poster designs for the radio-station north-wall board.
// Each design paints onto a 2D canvas context sized W×H (e.g. a Babylon
// DynamicTexture's context). Re-keyed to ART_DIRECTION.md:
//   wanted = TanKING red+gold · fields = World-1 home · morale = resistance
//   cobalt+gold · photo = swappable (purple-sunset default).
// Shared by HangarRadio.js (the in-world board) and the future hover easter-egg.

export const POSTER_DESIGNS = ['wanted', 'fields', 'morale', 'photo'];

function noise(x, W, H, n, a) {
  for (let i = 0; i < n; i++) { x.fillStyle = `rgba(80,60,30,${a})`;
    const rx = Math.random() * W, ry = Math.random() * H, r = 4 + Math.random() * 22;
    x.beginPath(); x.ellipse(rx, ry, r, r * 0.7, Math.random() * 3, 0, 7); x.fill(); }
}
function star(x, cx, cy, r, col) { x.fillStyle = col; x.beginPath();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 5 * i - Math.PI / 2, rad = i % 2 ? r * 0.45 : r;
    x.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); } x.closePath(); x.fill(); }
function fit(x, t, cx, y, maxW, px) { const f = p => '900 ' + p + 'px "Arial Black",Impact,sans-serif';
  x.font = f(px); while (px > 10 && x.measureText(t).width > maxW) { px -= 2; x.font = f(px); } x.fillText(t, cx, y); }
function tankKing(x, cx, cy) { x.save(); x.translate(cx, cy);
  x.fillStyle = '#23272d'; x.fillRect(-108, 30, 216, 30);
  x.fillStyle = '#3a3f47'; for (let i = -92; i <= 92; i += 26) { x.beginPath(); x.arc(i, 45, 11, 0, 7); x.fill(); }
  x.fillStyle = '#3c424b'; x.beginPath(); x.moveTo(-100, 32); x.lineTo(-86, -6); x.lineTo(90, -6); x.lineTo(104, 32); x.closePath(); x.fill();
  x.fillStyle = '#4a515b'; x.beginPath(); x.moveTo(-54, -6); x.lineTo(-42, -50); x.lineTo(40, -50); x.lineTo(58, -6); x.closePath(); x.fill();
  x.fillStyle = '#33383f'; x.fillRect(48, -34, 128, 15); x.fillStyle = '#2a2e34'; x.fillRect(166, -40, 16, 27);
  x.fillStyle = '#ff3b30'; x.beginPath(); x.moveTo(-30, -30); x.lineTo(-8, -22); x.lineTo(-30, -15); x.fill();
  x.beginPath(); x.moveTo(16, -30); x.lineTo(-6, -22); x.lineTo(16, -15); x.fill();
  x.fillStyle = '#e7b53a'; x.strokeStyle = '#9a7416'; x.lineWidth = 2; const cw = 92, cb = -50, ch = -92;
  x.beginPath(); x.moveTo(-cw / 2, cb); x.lineTo(-cw / 2, ch + 22); x.lineTo(-cw / 4, ch); x.lineTo(0, ch - 14); x.lineTo(cw / 4, ch); x.lineTo(cw / 2, ch + 22); x.lineTo(cw / 2, cb); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#b22a1f'; [-cw / 4, 0, cw / 4].forEach(jx => { x.beginPath(); x.arc(jx, ch + 16, 5, 0, 7); x.fill(); });
  x.restore(); }

const DRAW = {
  wanted(x, W, H) {
    x.fillStyle = '#d8c69a'; x.fillRect(0, 0, W, H); noise(x, W, H, 42, 0.05);
    x.fillStyle = '#8e2118'; x.fillRect(0, 0, W, 96); x.fillRect(0, H - 104, W, 104);
    x.fillStyle = '#e7b53a'; x.fillRect(0, 92, W, 5); x.fillRect(0, H - 109, W, 5);
    x.strokeStyle = '#241a0e'; x.lineWidth = 8; x.strokeRect(20, 20, W - 40, H - 40); x.textAlign = 'center';
    x.fillStyle = '#f0e3c0'; x.font = '900 64px "Arial Black",Impact,sans-serif'; x.fillText('WANTED', W / 2, 80);
    x.fillStyle = '#241a0e'; x.font = 'bold 30px Georgia'; x.fillText('— DEAD OR ALIVE —', W / 2, 150);
    const px = 82, py = 188, pw = W - 164, ph = 296;
    x.fillStyle = '#7e1d15'; x.fillRect(px - 8, py - 8, pw + 16, ph + 16);
    x.strokeStyle = '#e7b53a'; x.lineWidth = 5; x.strokeRect(px - 8, py - 8, pw + 16, ph + 16);
    x.fillStyle = '#c8c7c0'; x.fillRect(px, py, pw, ph);
    x.strokeStyle = 'rgba(40,30,20,0.22)'; x.lineWidth = 2;
    for (let gy = py + 34; gy < py + ph; gy += 40) { x.beginPath(); x.moveTo(px, gy); x.lineTo(px + pw, gy); x.stroke(); }
    tankKing(x, W / 2, py + ph / 2 + 24);
    x.fillStyle = '#241a0e'; x.font = '900 58px Georgia'; x.fillText('REWARD', W / 2, py + ph + 72);
    x.fillStyle = '#7e1d15'; x.font = 'bold 28px Georgia'; x.fillText('THE THRONE OF TANKFORD', W / 2, py + ph + 110);
    x.fillStyle = '#f0e3c0'; x.font = 'italic 21px Georgia'; x.fillText('· by order of the resistance ·', W / 2, H - 42);
  },
  fields(x, W, H) {
    x.fillStyle = '#87CEEB'; x.fillRect(0, 0, W, H * 0.52);
    x.fillStyle = '#fff3b0'; x.beginPath(); x.arc(W * 0.74, H * 0.2, 50, 0, 7); x.fill();
    const band = (c, b, a, p) => { x.fillStyle = c; x.beginPath(); x.moveTo(0, H); x.lineTo(0, b);
      for (let i = 0; i <= W; i += 24) { x.lineTo(i, b + Math.sin(i / 110 + p) * a); }
      x.lineTo(W, b + Math.sin(W / 110 + p) * a); x.lineTo(W, H); x.closePath(); x.fill(); };
    band('#8fd06a', H * 0.46, 14, 0.4); band('#6BBF4E', H * 0.56, 20, 1.8); band('#4e9e3a', H * 0.70, 16, 3.6);
    x.fillStyle = '#C4A882'; x.beginPath(); x.moveTo(W * 0.46, H); x.lineTo(W * 0.52, H * 0.72); x.lineTo(W * 0.6, H * 0.72); x.lineTo(W * 0.58, H); x.closePath(); x.fill();
    x.fillStyle = '#D4C9A8'; x.fillRect(W * 0.6, H * 0.52, 64, 46);
    x.fillStyle = '#A89880'; x.beginPath(); x.moveTo(W * 0.6 - 6, H * 0.52); x.lineTo(W * 0.6 + 32, H * 0.52 - 30); x.lineTo(W * 0.6 + 70, H * 0.52); x.closePath(); x.fill();
    x.fillStyle = '#5a3f22'; x.fillRect(W * 0.26 - 8, H * 0.56, 16, 66);
    x.fillStyle = '#4f8a3a'; x.beginPath(); x.moveTo(W * 0.26 - 42, H * 0.58); x.lineTo(W * 0.26, H * 0.50 - 26); x.lineTo(W * 0.26 + 42, H * 0.58); x.closePath(); x.fill();
    x.fillStyle = '#5fa247'; x.beginPath(); x.moveTo(W * 0.26 - 30, H * 0.50); x.lineTo(W * 0.26, H * 0.50 - 42); x.lineTo(W * 0.26 + 30, H * 0.50); x.closePath(); x.fill();
  },
  morale(x, W, H) {
    x.fillStyle = '#e9ddc0'; x.fillRect(0, 0, W, H); const cx = W / 2, cy = H * 0.40;
    x.save(); x.translate(cx, cy);
    for (let i = 0; i < 24; i++) { x.rotate(Math.PI * 2 / 24); x.fillStyle = i % 2 ? '#1f63cf' : '#1850a8';
      x.beginPath(); x.moveTo(0, 0); x.lineTo(40, -760); x.lineTo(-40, -760); x.closePath(); x.fill(); }
    x.restore();
    x.fillStyle = '#e9ddc0'; x.beginPath(); x.arc(cx, cy, 128, 0, 7); x.fill();
    x.strokeStyle = '#d4a843'; x.lineWidth = 8; x.beginPath(); x.arc(cx, cy, 128, 0, 7); x.stroke();
    x.strokeStyle = '#14315f'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, 118, 0, 7); x.stroke();
    x.fillStyle = '#14315f'; x.beginPath(); x.moveTo(cx - 34, cy + 70); x.lineTo(cx - 10, cy - 78); x.lineTo(cx + 10, cy - 78); x.lineTo(cx + 34, cy + 70); x.closePath(); x.fill();
    for (let i = 0; i < 4; i++) { x.fillRect(cx - 30 + (i * 16), cy + 50 - (i * 32), 60 - (i * 32), 6); }
    x.strokeStyle = '#d4a843'; x.lineWidth = 6; [40, 66, 92].forEach(r => { x.beginPath(); x.arc(cx, cy - 78, r, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); });
    star(x, cx, cy - 188, 22, '#d4a843');
    x.fillStyle = '#1f63cf'; x.fillRect(40, H - 184, W - 80, 118);
    x.strokeStyle = '#d4a843'; x.lineWidth = 4; x.strokeRect(40, H - 184, W - 80, 118);
    x.fillStyle = '#f3eede'; x.textAlign = 'center'; fit(x, 'KEEP', cx, H - 126, W - 130, 56); fit(x, 'TRANSMITTING', cx, H - 76, W - 116, 54);
  },
  photo(x, W, H, img) {
    x.fillStyle = '#f2eee4'; x.fillRect(0, 0, W, H); const m = 34, pw = W - 2 * m, ph = H - 2 * m - 104, py = m;
    if (img && img.width) {
      // cover-fit the uploaded image into the photo window
      const sc = Math.max(pw / img.width, ph / img.height), dw = img.width * sc, dh = img.height * sc;
      x.save(); x.beginPath(); x.rect(m, py, pw, ph); x.clip();
      x.drawImage(img, m + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh); x.restore();
    } else {
      const sky = x.createLinearGradient(0, py, 0, py + ph); sky.addColorStop(0, '#f6b65a'); sky.addColorStop(0.5, '#e8744e'); sky.addColorStop(1, '#7a3b6e');
      x.fillStyle = sky; x.fillRect(m, py, pw, ph);
      const sx = m + pw * 0.5, sy = py + ph * 0.46; x.fillStyle = 'rgba(255,240,190,0.95)'; x.beginPath(); x.arc(sx, sy, 52, 0, 7); x.fill();
      x.fillStyle = '#5a2f50'; x.beginPath(); x.moveTo(m, py + ph); x.lineTo(m, py + ph * 0.72);
      for (let i = 0; i <= pw; i += 20) { x.lineTo(m + i, py + ph * 0.74 + Math.sin(i / 70) * 14); }
      x.lineTo(m + pw, py + ph * 0.74 + Math.sin(pw / 70) * 14); x.lineTo(m + pw, py + ph); x.closePath(); x.fill();
    }
    x.fillStyle = 'rgba(220,205,150,0.6)'; x.save(); x.translate(m + 26, py - 2); x.rotate(-0.4); x.fillRect(-30, -12, 60, 24); x.restore();
    x.save(); x.translate(m + pw - 26, py - 2); x.rotate(0.4); x.fillRect(-30, -12, 60, 24); x.restore();
    x.fillStyle = '#34343a'; x.textAlign = 'center'; x.font = 'italic 36px "Bradley Hand",Georgia'; x.fillText(img && img.width ? 'home' : 'home // somewhere up there', W / 2, H - 44);
  },
};

/** Paint `design` onto the 2D context `ctx` (sized W×H). For 'photo', an optional
 *  loaded HTMLImageElement `img` is cover-fit into the polaroid window. */
export function drawPoster(ctx, design, W, H, img) {
  ctx.clearRect(0, 0, W, H);
  (DRAW[design] || DRAW.wanted)(ctx, W, H, img);
}
