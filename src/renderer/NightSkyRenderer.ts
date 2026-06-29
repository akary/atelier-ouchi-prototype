import type { Star, Vector2, Particle, PopFlash } from '../types';

// ====================================================
// 夜空の背景をエリック・カール風テクスチャで事前レンダリング
// ====================================================
function renderBackground(w: number, h: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2D context 取得失敗');

  // ベース: エリック・カール「お星様を描いて」の深い青
  ctx.fillStyle = '#060e3c';
  ctx.fillRect(0, 0, w, h);

  // 絵の具ブロック: ランダムなサイズの矩形を重ねて塗り重ね感を出す
  type PaintBlock = [number, number, number, number]; // [r, g, b, maxAlpha]
  const paintColors: PaintBlock[] = [
    [4, 10, 48, 0.18],   // 暗いインディゴ
    [6, 15, 60, 0.14],   // ネイビー
    [9, 20, 72, 0.11],   // 中間ネイビー
    [12, 28, 90, 0.07],  // やや明るいアクセント
    [3, 8, 38, 0.20],    // 最も暗い
    [5, 12, 52, 0.15],   // 標準ネイビー
    [14, 32, 96, 0.05],  // 淡い青（インクの溜まり）
  ];

  // 大きな絵の具の塊（刷毛で広げたような筆致）
  for (let i = 0; i < 160; i++) {
    const c = paintColors[i % paintColors.length]!;
    const alpha = Math.random() * c[3];
    ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
    const rw = 70 + Math.random() * 420;
    const rh = 25 + Math.random() * 180;
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillRect(x - rw / 2, y - rh / 2, rw, rh);
  }

  // 水平ブラシストローク（エリック・カールの絵に特有の横線）
  for (let i = 0; i < 600; i++) {
    const c = paintColors[Math.floor(Math.random() * paintColors.length)]!;
    const alpha = Math.random() * 0.10;
    ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
    const x = Math.random() * w * 0.4;
    const strokeW = w * 0.35 + Math.random() * w * 0.65;
    const y = Math.random() * h;
    const strokeH = 1 + Math.random() * 2.5;
    ctx.fillRect(x, y, strokeW, strokeH);
  }

  // 背景の小さな星（インタラクティブな星とは別の、遠くの星）
  for (let i = 0; i < 65; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() < 0.75 ? 0.7 : 1.3;
    const alpha = 0.22 + Math.random() * 0.52;
    ctx.fillStyle = `rgba(240,242,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 紙の目（コウゾ紙のような細かい繊維テクスチャ）
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillStyle = `rgba(90,130,210,${Math.random() * 0.016})`;
    ctx.fillRect(x, y, 1, 1);
  }

  return canvas;
}

// ====================================================
// メイン描画クラス
// ====================================================
export class NightSkyRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private background: OffscreenCanvas;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context 取得失敗');
    this.ctx = ctx;

    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.background = renderBackground(this.canvas.width, this.canvas.height);

    window.addEventListener('resize', () => this.resize());
  }

  draw(
    stars: readonly Star[],
    particles: readonly Particle[],
    flashes: readonly PopFlash[],
    mousePos: Vector2,
  ): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(this.background, 0, 0);

    for (const star of stars) this.drawStar(star);
    for (const p of particles) this.drawParticle(p);
    for (const f of flashes)   this.drawFlash(f);

    this.drawCursorGlow(mousePos);
  }

  private drawStar(star: Star): void {
    const { ctx } = this;
    const { position, size, texture, opacity } = star;

    if (opacity <= 0) return;

    // フェードイン中は 0.6 → 1.0 にスケールアップして出現感を出す
    const scale       = opacity < 1 ? 0.6 + opacity * 0.4 : 1.0;
    const drawRadius  = size * scale;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(
      texture,
      position.x - drawRadius * 1.2,
      position.y - drawRadius * 1.2,
      drawRadius * 2.4,
      drawRadius * 2.4,
    );
    ctx.restore();
  }

  private drawParticle(p: Particle): void {
    const { ctx } = this;
    if (p.size < 0.5 || p.opacity <= 0.01) return;

    ctx.save();
    ctx.translate(p.position.x, p.position.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle   = p.color;

    if (p.shape === 'sparkle') {
      this.draw4PointedStar(p.size);
    } else {
      // ドット: 中心に小さなグロー
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = p.size * 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // 4芒星（✦）を原点中心に描画
  private draw4PointedStar(size: number): void {
    const s = size;
    const w = s * 0.20; // アームの幅
    this.ctx.beginPath();
    this.ctx.moveTo(0, -s);
    this.ctx.bezierCurveTo( w, -w,  w, -w,  s,  0);
    this.ctx.bezierCurveTo( w,  w,  w,  w,  0,  s);
    this.ctx.bezierCurveTo(-w,  w, -w,  w, -s,  0);
    this.ctx.bezierCurveTo(-w, -w, -w, -w,  0, -s);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawFlash(f: PopFlash): void {
    const { ctx } = this;
    if (f.opacity <= 0) return;

    const { position: pos, radius, opacity } = f;
    const grd = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);
    grd.addColorStop(0,   `rgba(255,255,220,${opacity * 0.92})`);
    grd.addColorStop(0.35,`rgba(255,255,180,${opacity * 0.50})`);
    grd.addColorStop(1,   'rgba(255,255,180,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(pos.x - radius, pos.y - radius, radius * 2, radius * 2);
  }

  private drawCursorGlow(pos: Vector2): void {
    const { ctx } = this;
    const r = 90;
    const grd = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r);
    grd.addColorStop(0,   'rgba(255,255,200,0.13)');
    grd.addColorStop(0.5, 'rgba(255,245,180,0.05)');
    grd.addColorStop(1,   'rgba(255,245,180,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(pos.x - r, pos.y - r, r * 2, r * 2);
  }

  private resize(): void {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.background = renderBackground(this.canvas.width, this.canvas.height);
  }
}
