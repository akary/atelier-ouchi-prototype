import { applyHomography, type Homography } from './homography';
import type { Vec2, Hittable } from './types';
// 型のみ静的 import（コンパイル時に消える＝実行コスト0）。
// 実体（数MBのWASMグルー）は init() 内で動的 import し、使うまで読み込まない。
import type { HandLandmarker } from '@mediapipe/tasks-vision';

export interface HandTrackerOptions {
  /** カメラが対面（自撮り的）で映像が鏡像になる場合 true（未キャリブレ時のみ影響）。 */
  flipX?: boolean;
  /** 同時に検出する手の数。 */
  maxHands?: number;
  /** MediaPipe wasm の置き場所（public 配下）。 */
  wasmPath?: string;
  /** hand_landmarker.task モデルの置き場所（public 配下）。 */
  modelPath?: string;
  /** 星との当たり判定半径 = size * この係数。 */
  hitRadiusFactor?: number;
  /** カメラ解像度のヒント。 */
  cameraWidth?: number;
  cameraHeight?: number;
}

const PALM_CENTER = 9; // 中指付け根 ≒ 手のひら中心（カーソル表示に使用）

/**
 * MediaPipe Hands による手トラッキング（アプリ非依存の再利用コア）。
 * 手の全ランドマークをスクリーン座標の「触点」に変換し、
 * 4点キャリブレ（ホモグラフィ）で投影面へ正しくマッピングする。
 */
export class HandTracker {
  private readonly video: HTMLVideoElement;
  private landmarker: HandLandmarker | null = null;
  private ready = false;

  private readonly flipX: boolean;
  private readonly maxHands: number;
  private readonly wasmPath: string;
  private readonly modelPath: string;
  private readonly hitRadiusFactor: number;
  private readonly cameraWidth: number;
  private readonly cameraHeight: number;

  private touchPoints: Vec2[] = [];
  private primaryPos: Vec2 | null = null;
  private lastHands: Vec2[][] = [];
  private lastVideoTime = -1;
  private homography: Homography | null = null;

  constructor(opts: HandTrackerOptions = {}) {
    this.flipX = opts.flipX ?? false;
    this.maxHands = opts.maxHands ?? 2;
    this.wasmPath = opts.wasmPath ?? '/mediapipe/wasm';
    this.modelPath = opts.modelPath ?? '/mediapipe/hand_landmarker.task';
    this.hitRadiusFactor = opts.hitRadiusFactor ?? 1.5;
    this.cameraWidth = opts.cameraWidth ?? 640;
    this.cameraHeight = opts.cameraHeight ?? 480;

    this.video = document.createElement('video');
    this.video.autoplay = true;
    this.video.muted = true;
    this.video.playsInline = true;
  }

  async init(): Promise<void> {
    // 1) カメラ起動
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: this.cameraWidth },
        height: { ideal: this.cameraHeight },
      },
      audio: false,
    });
    this.video.srcObject = stream;
    await new Promise<void>((resolve) => {
      this.video.onloadedmetadata = () => { this.video.play(); resolve(); };
    });

    // 2) MediaPipe Hands 初期化（本体はここで初めて動的ロード）
    const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(this.wasmPath);
    this.landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: this.modelPath, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: this.maxHands,
    });

    this.ready = true;
    console.log('[HandTracker] 初期化完了（MediaPipe Hands）');
  }

  /** メインループから毎フレーム呼ぶ。手のランドマークを更新する。 */
  tick(): void {
    if (!this.ready || !this.landmarker) return;
    if (this.video.currentTime === this.lastVideoTime) return; // 同フレーム二重処理を防ぐ
    this.lastVideoTime = this.video.currentTime;

    const result = this.landmarker.detectForVideo(this.video, performance.now());

    const W = window.innerWidth;
    const H = window.innerHeight;
    const points: Vec2[] = [];
    const hands: Vec2[][] = [];
    let primary: Vec2 | null = null;

    for (const landmarks of result.landmarks ?? []) {
      const handPts: Vec2[] = [];
      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i]!;
        // カメラ正規化座標[0,1] → スクリーン座標。
        // キャリブレ済みなら射影変換で台形歪み・傾きを補正。未キャリブレは単純引き伸ばし。
        const p = this.homography
          ? applyHomography(this.homography, { x: lm.x, y: lm.y })
          : { x: (this.flipX ? 1 - lm.x : lm.x) * W, y: lm.y * H };
        handPts.push(p);
        points.push(p);
        if (i === PALM_CENTER && !primary) primary = p;
      }
      hands.push(handPts);
    }

    this.touchPoints = points;
    this.lastHands = hands;
    if (primary) this.primaryPos = primary; // ロスト時は最後の位置を保持
  }

  /** カーソル表示用の代表点（最初の手の手のひら中心）。手がなければ画面外。 */
  getPos(): Vec2 {
    return this.primaryPos ?? { x: -9999, y: -9999 };
  }

  /** スクリーン座標に変換済みの全触点（全ての手の全ランドマーク）。 */
  getTouchPoints(): readonly Vec2[] {
    return this.touchPoints;
  }

  /**
   * いずれかの触点が重なっているオブジェクトを1つ返す（最近傍）。
   * 各コンテンツ固有の型（星など）が Hittable を満たしていれば渡せる。
   */
  findCollision<T extends Hittable>(items: readonly T[], radiusFactor = this.hitRadiusFactor): T | null {
    if (this.touchPoints.length === 0) return null;

    let closest: T | null = null;
    let closestDist = Infinity;

    for (const item of items) {
      if (item.opacity !== undefined && item.opacity < 0.5) continue;
      const r = item.size * radiusFactor;
      for (const pt of this.touchPoints) {
        const d = Math.hypot(pt.x - item.position.x, pt.y - item.position.y);
        if (d < r && d < closestDist) {
          closest = item;
          closestDist = d;
        }
      }
    }
    return closest;
  }

  setHomography(H: Homography | null): void { this.homography = H; }
  hasHomography(): boolean { return this.homography !== null; }

  /** カメラのライブ映像（セットアップ/キャリブレ/デバッグのプレビュー用）。 */
  getVideoElement(): HTMLVideoElement { return this.video; }

  /** デバッグ描画用：手ごとのスクリーン座標ランドマーク。 */
  getLastHands(): readonly Vec2[][] { return this.lastHands; }

  isReady(): boolean { return this.ready; }
}
