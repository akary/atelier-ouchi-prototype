import type { Star, Vector2, IPositionTracker, ShadowData } from '../types';
import { ShadowTracker } from './ShadowTracker';
import { distance } from '../utils/math';

const HIT_RADIUS_FACTOR = 1.5;
const CAM_W = 320;
const CAM_H = 240;

export class CameraTracker implements IPositionTracker {
  private readonly video: HTMLVideoElement;
  private readonly shadow: ShadowTracker;
  private calibrated = false;
  private shadowPos: Vector2 | null = null;
  private shadowHitRadius = 0;
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

      // 影のサイズをスクリーン座標系に換算（当たり判定の追加半径に使う）
      this.shadowHitRadius =
        (Math.max(bb.width, bb.height) / 2) * Math.max(scaleX, scaleY);
    } else {
      // 検出が途切れても shadowPos はリセットしない（最後の位置に留まる）
      // ノイズ等で一瞬検出が飛んだ際に、反対側などへ瞬間移動するのを防ぐため
      this.shadowHitRadius = 0;
    }
  }

  getPos(): Vector2 {
    return this.shadowPos ?? { x: -9999, y: -9999 }; // 影がなければ画面外
  }

  findCollision(stars: readonly Star[]): Star | null {
    if (!this.shadowPos) return null;

    const pos = this.shadowPos;
    // 影のサイズ分だけ当たり判定を広げる（上限あり）
    const extraRadius = Math.min(this.shadowHitRadius * 0.4, 120);

    let closest: Star | null = null;
    let closestDist = Infinity;

    for (const star of stars) {
      if (star.opacity < 0.5) continue;
      const dist = distance(pos, star.position);
      if (
        dist < star.size * HIT_RADIUS_FACTOR + extraRadius &&
        dist < closestDist
      ) {
        closest     = star;
        closestDist = dist;
      }
    }
    return closest;
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
