import type { Star, Vector2, Particle, PopFlash } from '../types';
import type { SceneImages } from '../utils/imageLoader';

// 月の表示サイズと縦位置（横位置は canvas.width/3 で動的に決まる）
export const MOON_SIZE = 260;
export const MOON_CY   = 132;
const LADDER_W  = 80;  // 梯子の表示幅
const PAPA_W    = 64;  // パパの表示幅
const PAPA_H    = 88;  // パパの表示高さ
const STONE_W       = 160; // 石の表示幅
const STONE_SINK_PX = 160;  // 石を地面画像に埋め込む量（浮き防止）

// ====================================================
// メイン描画クラス
// ====================================================
export class NightSkyRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly images: readonly HTMLImageElement[];
  private readonly scene: SceneImages;

  constructor(
    canvas: HTMLCanvasElement,
    images: readonly HTMLImageElement[],
    scene: SceneImages,
  ) {
    this.canvas = canvas;
    this.images = images;
    this.scene  = scene;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context 取得失敗');
    this.ctx = ctx;

    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;

    window.addEventListener('resize', () => this.resize());
  }

  draw(
    stars: readonly Star[],
    particles: readonly Particle[],
    flashes: readonly PopFlash[],
    mousePos: Vector2,
    papaProgress: number,
  ): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(this.scene.background, 0, 0, canvas.width, canvas.height);

    for (const star of stars) this.drawStar(star);

    this.drawMoon();
    this.drawLadder();
    this.drawGround();
    this.drawStone();

    this.drawPapa(papaProgress);

    for (const p of particles) this.drawParticle(p);
    for (const f of flashes)   this.drawFlash(f);

    this.drawCursorGlow(mousePos);
  }

  private drawMoon(): void {
    const { ctx, canvas } = this;
    const moonCX = Math.round(canvas.width / 3);
    // 月のぼんやりした光の輪
    const haloR = MOON_SIZE * 0.9;
    const grd = ctx.createRadialGradient(moonCX, MOON_CY, MOON_SIZE * 0.4, moonCX, MOON_CY, haloR);
    grd.addColorStop(0,   'rgba(255,248,200,0.22)');
    grd.addColorStop(1,   'rgba(255,248,200,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(moonCX - haloR, MOON_CY - haloR, haloR * 2, haloR * 2);
    // 月の画像
    ctx.drawImage(this.scene.moon, moonCX - MOON_SIZE / 2, MOON_CY - MOON_SIZE / 2 + 20, MOON_SIZE, MOON_SIZE);
  }

  // 梯子のジオメトリを計算して返す。
  // 梯子の上端は月の縁（中心ではなく、月の表面に届く点）とする。
  private getLadderGeometry(): { bx: number; by: number; topX: number; topY: number; dx: number; dy: number; len: number; angle: number } {
    const moonCX = Math.round(this.canvas.width / 3);
    const bx = this.canvas.width / 2;
    const by = this.canvas.height;
    // 月の中心から梯子の下端方向への単位ベクトルを求め、月の半径分だけオフセットした点を上端とする
    const toBottomX = bx - moonCX;
    const toBottomY = by - MOON_CY;
    const moonDist  = Math.hypot(toBottomX, toBottomY);
    const topX = moonCX + (toBottomX / moonDist) * (MOON_SIZE / 2);
    const topY = MOON_CY + (toBottomY / moonDist) * (MOON_SIZE / 2);
    const dx    = topX - bx;
    const dy    = topY - by;
    const len   = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    return { bx, by, topX, topY, dx, dy, len, angle };
  }

  private drawLadder(): void {
    const { ctx } = this;
    const { bx, by, topX, topY, len, angle } = this.getLadderGeometry();

    ctx.save();
    ctx.translate((bx + topX) / 2, (by + topY) / 2);
    ctx.rotate(angle + Math.PI / 2);
    ctx.drawImage(this.scene.ladder, -LADDER_W / 2+15, -len / 2, LADDER_W, len);
    ctx.restore();
  }

  private getGroundH(): number {
    const img = this.scene.ground;
    return img.height * (this.canvas.width / img.width);
  }

  private getStoneH(): number {
    const img = this.scene.stone;
    return img.height * (STONE_W / img.width);
  }

  private drawGround(): void {
    const { ctx, canvas } = this;
    const groundH = this.getGroundH();
    ctx.drawImage(this.scene.ground, 0, canvas.height - groundH, canvas.width, groundH);
  }

  private drawStone(): void {
    const { ctx, canvas } = this;
    const groundH = this.getGroundH();
    const stoneH  = this.getStoneH();
    ctx.drawImage(
      this.scene.stone,
      canvas.width / 2 - STONE_W / 2,
      canvas.height - groundH - stoneH + STONE_SINK_PX,
      STONE_W,
      stoneH,
    );
  }

  private drawPapa(progress: number): void {
    const { ctx, canvas } = this;
    const { topX, topY } = this.getLadderGeometry();

    // スタート位置: 石の上端（梯子の根元）
    const groundH = this.getGroundH();
    const stoneH  = this.getStoneH();
    const startX  = canvas.width / 2;
    const startY  = canvas.height - groundH - stoneH + STONE_SINK_PX;

    const dx    = topX - startX;
    const dy    = topY - startY;
    const angle = Math.atan2(dy, dx);

    const px = startX + dx * progress;
    const py = startY + dy * progress;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle + Math.PI / 2 + 0.25); // 少し傾ける
    ctx.drawImage(this.scene.papa, -PAPA_W / 2, -PAPA_H / 2, PAPA_W, PAPA_H);
    ctx.restore();
  }

  private drawStar(star: Star): void {
    const { ctx } = this;
    const { position, size, opacity, imageIndex, rotation } = star;

    if (opacity <= 0) return;

    const img = this.images[imageIndex];
    if (!img) return;

    // フェードイン中は 0.6 → 1.0 にスケールアップして出現感を出す
    const scale    = opacity < 1 ? 0.6 + opacity * 0.4 : 1.0;
    const drawSize = size * 2 * scale;

    ctx.save();
    ctx.globalAlpha  = opacity;
    ctx.translate(position.x, position.y);
    ctx.rotate(rotation);
    // 淡い黄色のグロー（夜空に浮かんでいる感）
    ctx.shadowColor = 'rgba(255, 240, 150, 0.5)';
    ctx.shadowBlur  = size * 0.5 * scale;
    ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
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
  }
}
