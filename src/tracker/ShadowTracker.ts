import type { ShadowData, BoundingBox } from '../types';

const CANVAS_W = 640;
const CANVAS_H = 480;
const DIFF_THRESHOLD = 30; // 背景差分の感度（大きいほど鈍感）

export class ShadowTracker {
  private video: HTMLVideoElement;
  private offscreen: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  private background: ImageData | null = null;

  constructor(video: HTMLVideoElement) {
    this.video = video;
    this.offscreen = new OffscreenCanvas(CANVAS_W, CANVAS_H);
    const ctx = this.offscreen.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2D context 取得失敗');
    this.ctx = ctx;
  }

  // 何もない状態の背景フレームを保存（アプリ起動直後に呼ぶ）
  calibrate(): void {
    this.ctx.drawImage(this.video, 0, 0, CANVAS_W, CANVAS_H);
    this.background = this.ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    console.log('[ShadowTracker] 背景キャリブレーション完了');
  }

  process(): ShadowData {
    this.ctx.drawImage(this.video, 0, 0, CANVAS_W, CANVAS_H);
    const current = this.ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);

    const mask = this.background
      ? this.subtractBackground(current, this.background)
      : current;

    return {
      mask,
      boundingBox: this.computeBoundingBox(mask),
      timestamp: performance.now(),
    };
  }

  private subtractBackground(current: ImageData, bg: ImageData): ImageData {
    const result = new ImageData(CANVAS_W, CANVAS_H);

    for (let i = 0; i < current.data.length; i += 4) {
      const diff =
        Math.abs(current.data[i]     - bg.data[i])     +
        Math.abs(current.data[i + 1] - bg.data[i + 1]) +
        Math.abs(current.data[i + 2] - bg.data[i + 2]);

      const moving = diff > DIFF_THRESHOLD;
      result.data[i]     = moving ? 255 : 0;
      result.data[i + 1] = moving ? 255 : 0;
      result.data[i + 2] = moving ? 255 : 0;
      result.data[i + 3] = moving ? 200 : 0;
    }

    return result;
  }

  // 差分マスクから動体のバウンディングボックスを計算
  private computeBoundingBox(mask: ImageData): BoundingBox | null {
    let minX = CANVAS_W, minY = CANVAS_H, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < CANVAS_H; y++) {
      for (let x = 0; x < CANVAS_W; x++) {
        const alpha = mask.data[(y * CANVAS_W + x) * 4 + 3];
        if (alpha > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          found = true;
        }
      }
    }

    if (!found) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}
