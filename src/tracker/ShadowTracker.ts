import type { ShadowData, BoundingBox } from '../types';

// 毎フレーム getImageData + 差分ループが走るので小さめに
const CANVAS_W = 320;
const CANVAS_H = 240;
const DIFF_THRESHOLD = 90; // 背景差分の感度（大きいほど鈍感。暗所だとセンサーノイズが大きく低い値だと画面全体が誤検出する）
// センサーノイズ等で数ピクセルだけ反応するケースを「未検出」扱いにする下限
// (320x240=76800px 中、これ未満なら無視)
const MIN_MOVING_PIXELS = 400;
// 背景の追従速度。自動露出・自動ホワイトバランスによるゆっくりした明るさ変化を
// 吸収するため、「動いていない」と判定された部分だけ毎フレーム少しずつ現在の
// 映像に近づける（大きいほど速く追従するが、敏感になりすぎると検出感度が落ちる）
const BG_ADAPT_RATE = 0.02;
// 動体ピクセルの割合がこれを超えたら「本物の動きではなく露出が急変した」と判断し、
// 背景をその場で撮り直す（adaptBackground は動いていない部分しか更新しないため、
// 画面のほぼ全部が動体判定されると一切回復できずロックしてしまうのを防ぐ安全装置）
const RESET_RATIO_THRESHOLD = 0.85;

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

    if (this.background) {
      const movingRatio = this.countMoving(mask) / (CANVAS_W * CANVAS_H);

      if (movingRatio > RESET_RATIO_THRESHOLD) {
        // 露出・ホワイトバランスの急変と判断し、背景を即座に撮り直す
        this.background = current;
        console.warn('[ShadowTracker] 画面全体の急変を検出 → 背景を再キャプチャしました');
        return { mask: new ImageData(CANVAS_W, CANVAS_H), boundingBox: null, timestamp: performance.now() };
      }

      // 「動いていない」と判定された部分だけ背景をゆっくり更新（明るさ変化に追従）
      this.adaptBackground(current, mask);
    }

    return {
      mask,
      boundingBox: this.computeBoundingBox(mask),
      timestamp: performance.now(),
    };
  }

  private countMoving(mask: ImageData): number {
    let count = 0;
    for (let i = 3; i < mask.data.length; i += 4) {
      if (mask.data[i] > 0) count++;
    }
    return count;
  }

  private adaptBackground(current: ImageData, mask: ImageData): void {
    if (!this.background) return;
    const bg  = this.background.data;
    const cur = current.data;
    const m   = mask.data;

    for (let i = 0; i < bg.length; i += 4) {
      if (m[i + 3] === 0) { // 動いていないピクセルだけ背景に取り込む
        bg[i]     += (cur[i]     - bg[i])     * BG_ADAPT_RATE;
        bg[i + 1] += (cur[i + 1] - bg[i + 1]) * BG_ADAPT_RATE;
        bg[i + 2] += (cur[i + 2] - bg[i + 2]) * BG_ADAPT_RATE;
      }
    }
  }

  private subtractBackground(current: ImageData, bg: ImageData): ImageData {
    const result = new ImageData(CANVAS_W, CANVAS_H);

    for (let i = 0; i < current.data.length; i += 4) {
      // 「背景より暗くなった量」だけを影として検出する。
      // 星の爆発アニメーション（明るくなる変化）は darkening が負になるため
      // 自動的に無視され、人物の影（投影を遮って暗くなる）だけが反応する。
      const darkening =
        (bg.data[i]     - current.data[i])     +
        (bg.data[i + 1] - current.data[i + 1]) +
        (bg.data[i + 2] - current.data[i + 2]);

      const moving = darkening > DIFF_THRESHOLD;
      result.data[i]     = moving ? 255 : 0;
      result.data[i + 1] = moving ? 255 : 0;
      result.data[i + 2] = moving ? 255 : 0;
      result.data[i + 3] = moving ? 200 : 0;
    }

    return result;
  }

  // 差分マスクから動体のバウンディングボックス＋重心を計算
  private computeBoundingBox(mask: ImageData): BoundingBox | null {
    let minX = CANVAS_W, minY = CANVAS_H, maxX = 0, maxY = 0;
    let count = 0, sumX = 0, sumY = 0;

    for (let y = 0; y < CANVAS_H; y++) {
      for (let x = 0; x < CANVAS_W; x++) {
        const alpha = mask.data[(y * CANVAS_W + x) * 4 + 3];
        if (alpha > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }

    // ノイズ（センサーノイズ等で数ピクセルだけ反応）は「未検出」扱いにする
    if (count < MIN_MOVING_PIXELS) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: sumX / count, // 重心：外れ値ノイズに強い
      centerY: sumY / count,
    };
  }
}
