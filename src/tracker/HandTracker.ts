import type { Star, Vector2, IPositionTracker } from '../types';
import { distance } from '../utils/math';
// 型のみ静的 import（コンパイル時に消える＝実行コスト0）。
// 実体（数MBのWASMグルー）は init() 内で動的 import し、手モードを使うまで読み込まない。
import type { HandLandmarker } from '@mediapipe/tasks-vision';

// 当たり判定の倍率（star.size の何倍以内でポップするか）。MouseTracker と揃える。
const HIT_RADIUS_FACTOR = 1.5;
// 同時に検出する手の数（両手対応）
const MAX_HANDS = 2;

const CAM_W = 640;
const CAM_H = 480;

// MediaPipe のランドマーク index。手の甲側からでも検出できるよう、
// 指先だけでなく手全体のランドマークを「触点」として使う（1歳児は手のひら全体で触る）。
const PALM_CENTER = 9; // 中指付け根 ≒ 手のひら中心（カーソル表示に使用）

/**
 * MediaPipe Hands による指先トラッキング。
 * 影ではなく「手」だけを見るので、体の影や胴体には一切反応しない。
 * 手の 21 ランドモーク全部を触点として星との当たり判定に使う。
 */
export class HandTracker implements IPositionTracker {
  private readonly video: HTMLVideoElement;
  private landmarker: HandLandmarker | null = null;
  private ready = false;

  // スクリーン座標に変換済みの触点（全ての手の全ランドマークを平らに詰める）
  private touchPoints: Vector2[] = [];
  // カーソル表示用の代表点（最初の手の手のひら中心）
  private primaryPos: Vector2 | null = null;
  // デバッグ描画用：手ごとのスクリーン座標ランドマーク配列
  private lastHands: Vector2[][] = [];
  private lastVideoTime = -1;

  /**
   * @param flipX カメラが子どもと対面（自撮り的）で映像が鏡像になる場合 true。
   *              プロジェクターとカメラの位置関係で調整する。
   */
  constructor(private readonly flipX = false) {
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
        width: { ideal: CAM_W },
        height: { ideal: CAM_H },
      },
      audio: false,
    });
    this.video.srcObject = stream;
    await new Promise<void>((resolve) => {
      this.video.onloadedmetadata = () => { this.video.play(); resolve(); };
    });

    // 2) MediaPipe Hands 初期化（wasm/モデルはローカル public/ から読む＝オフラインOK）
    // ライブラリ本体はここで初めて動的ロード（マウス/影モードには一切影響しない）
    const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
    this.landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: '/mediapipe/hand_landmarker.task',
        delegate: 'GPU', // WebGL/WebGPU 経由で高速化。非対応環境では自動で CPU にフォールバック
      },
      runningMode: 'VIDEO',
      numHands: MAX_HANDS,
    });

    this.ready = true;
    console.log('[HandTracker] 初期化完了（MediaPipe Hands）');
  }

  /** メインループから毎フレーム呼ぶ。手のランドマークを更新する。 */
  tick(): void {
    if (!this.ready || !this.landmarker) return;

    // 同じフレームを二重処理しない（video.currentTime が進んだ時だけ推論）
    if (this.video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.video.currentTime;

    const result = this.landmarker.detectForVideo(this.video, performance.now());

    const W = window.innerWidth;
    const H = window.innerHeight;
    const points: Vector2[] = [];
    const hands: Vector2[][] = [];
    let primary: Vector2 | null = null;

    for (const landmarks of result.landmarks ?? []) {
      const handPts: Vector2[] = [];
      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i]!;
        // 正規化座標[0,1] → スクリーン座標。アスペクト比の違いはここでは無視
        // （台形歪みの厳密補正は後段の 4 点ホモグラフィで対応予定）
        const sx = (this.flipX ? 1 - lm.x : lm.x) * W;
        const sy = lm.y * H;
        const p = { x: sx, y: sy };
        handPts.push(p);
        points.push(p);
        if (i === PALM_CENTER && !primary) primary = p;
      }
      hands.push(handPts);
    }

    this.touchPoints = points;
    this.lastHands = hands;
    // 手が消えても primaryPos は最後の位置に残す（一瞬のロストで瞬間移動しないため）
    if (primary) this.primaryPos = primary;
  }

  getPos(): Vector2 {
    return this.primaryPos ?? { x: -9999, y: -9999 };
  }

  // いずれかの触点が重なっている星を1つ返す（最近傍）。
  // 手のランドマーク全部を見るので、指先でも手のひらでも触れれば反応する。
  findCollision(stars: readonly Star[]): Star | null {
    if (this.touchPoints.length === 0) return null;

    let closest: Star | null = null;
    let closestDist = Infinity;

    for (const star of stars) {
      if (star.opacity < 0.5) continue; // フェードイン中は当たり判定なし
      const r = star.size * HIT_RADIUS_FACTOR;
      for (const pt of this.touchPoints) {
        const d = distance(pt, star.position);
        if (d < r && d < closestDist) {
          closest = star;
          closestDist = d;
        }
      }
    }
    return closest;
  }

  /** カメラのライブ映像（セットアップ/デバッグのプレビュー用） */
  getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  /** デバッグ描画用：手ごとのスクリーン座標ランドマーク */
  getLastHands(): Vector2[][] {
    return this.lastHands;
  }

  isReady(): boolean {
    return this.ready;
  }
}
