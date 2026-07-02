import type { Star, Vector2, IPositionTracker, ShadowData } from '../types';
import { ShadowTracker } from './ShadowTracker';

const HIT_RADIUS_FACTOR = 1.5;
const CAM_W = 320;
const CAM_H = 240;
// 星の当たり判定円の中で、この割合以上が動体ピクセルなら「触れた」とみなす
const OCCLUSION_RATIO_THRESHOLD = 0.2;

export class CameraTracker implements IPositionTracker {
  private readonly video: HTMLVideoElement;
  private readonly shadow: ShadowTracker;
  private calibrated = false;
  private shadowPos: Vector2 | null = null;
  private lastShadowData: ShadowData | null = null;

  /**
   * @param flipX - カメラが子どもの真後ろ配置の場合、X軸を反転する（デフォルト true）
   *               プロジェクターと子どもの位置関係によって調整すること
   */
  constructor(private readonly flipX = true) {
    this.video = document.createElement('video');
    this.video.autoplay    = true;
    this.video.muted       = true;
    this.video.playsInline = true;
    this.shadow = new ShadowTracker(this.video);
  }

  async init(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' }, // 背面カメラ優先
        width:  { ideal: CAM_W },
        height: { ideal: CAM_H },
      },
      audio: false,
    });
    this.video.srcObject = stream;
    await new Promise<void>((resolve) => {
      this.video.onloadedmetadata = () => { this.video.play(); resolve(); };
    });
    console.log('[CameraTracker] カメラ起動完了');
  }

  /** 子どもがいない状態で呼ぶ。背景フレームを記録する */
  calibrate(): void {
    this.shadow.calibrate();
    this.calibrated = true;
    console.log('[CameraTracker] キャリブレーション完了');
  }

  /**
   * メインループから毎フレーム呼ぶ。
   * 影の中心座標とサイズを更新する。
   */
  tick(): void {
    if (!this.calibrated) return;
    const result = this.shadow.process();
    this.lastShadowData = result;

    if (result.boundingBox) {
      const bb    = result.boundingBox;
      const scaleX = window.innerWidth  / CAM_W;
      const scaleY = window.innerHeight / CAM_H;

      // カメラ座標 → スクリーン座標（重心を使用。外れノイズに強い）
      const rawX = bb.centerX * scaleX;
      const rawY = bb.centerY * scaleY;

      this.shadowPos = {
        x: this.flipX ? window.innerWidth - rawX : rawX,
        y: rawY,
      };
    }
    // 検出が途切れても shadowPos はリセットしない（最後の位置に留まる）
    // ノイズ等で一瞬検出が飛んだ際に、反対側などへ瞬間移動するのを防ぐため
  }

  getPos(): Vector2 {
    return this.shadowPos ?? { x: -9999, y: -9999 }; // 影がなければ画面外
  }

  // 星ごとに「その星が壁に投影されている場所が影マスクで遮られているか」を直接調べる。
  // 体全体の重心ではなく星の位置をピンポイントで見るので、手を伸ばすだけでも反応する。
  findCollision(stars: readonly Star[]): Star | null {
    if (!this.lastShadowData) return null;

    for (const star of stars) {
      if (star.opacity < 0.5) continue;
      if (this.isStarOccluded(star)) return star;
    }
    return null;
  }

  private isStarOccluded(star: Star): boolean {
    const mask = this.lastShadowData?.mask;
    if (!mask) return false;

    const scaleX = window.innerWidth  / CAM_W;
    const scaleY = window.innerHeight / CAM_H;

    // 星のスクリーン座標 → カメラ座標へ逆変換（getPos の変換の逆）
    const rawX = this.flipX ? window.innerWidth - star.position.x : star.position.x;
    const camX = rawX / scaleX;
    const camY = star.position.y / scaleY;

    // 星の当たり判定半径をカメラ座標系に変換（小さすぎるとサンプル数が足りないので下限あり）
    const radius = Math.max((star.size * HIT_RADIUS_FACTOR) / Math.max(scaleX, scaleY), 5);

    let sampled = 0;
    let occluded = 0;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue; // 円形に絞る
        const x = Math.round(camX + dx);
        const y = Math.round(camY + dy);
        if (x < 0 || x >= CAM_W || y < 0 || y >= CAM_H) continue;

        sampled++;
        if (mask.data[(y * CAM_W + x) * 4 + 3] > 0) occluded++;
      }
    }

    return sampled > 0 && occluded / sampled > OCCLUSION_RATIO_THRESHOLD;
  }

  getLastShadowData(): ShadowData | null {
    return this.lastShadowData;
  }

  /** カメラのライブ映像を取得（セットアップ UI のプレビューに使う） */
  getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  isCalibrated(): boolean {
    return this.calibrated;
  }
}
