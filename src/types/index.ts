// 座標・ベクトル
export interface Vector2 {
  x: number;
  y: number;
}

// MediaPipe が出力するランドマーク1点
export interface PoseLandmark {
  x: number;   // 0.0〜1.0 (正規化)
  y: number;
  z: number;
  visibility?: number; // 0.0〜1.0
}

// 骨格トラッカーの出力
export interface PoseData {
  landmarks: PoseLandmark[];
  timestamp: number;
}

// 背景差分トラッカーの出力
export interface ShadowData {
  mask: ImageData;
  boundingBox: BoundingBox | null;
  timestamp: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number; // 動体ピクセルの重心（ノイズ等の外れ値に強い）
  centerY: number;
}

// Renderer が毎フレーム受け取る合成出力
export interface TrackerOutput {
  pose: PoseData | null;
  shadow: ShadowData | null;
}

// ========== Tracker 共通インターフェース ==========

export interface IPositionTracker {
  /** カーソル or 影の中心座標をスクリーン座標で返す */
  getPos(): Vector2;
  /** 触れている星を1つ返す（なければ null） */
  findCollision(stars: readonly Star[]): Star | null;
}

// ========== Star Catch Scene ==========

export interface Star {
  readonly id: number;
  position: Vector2;
  readonly size: number;
  readonly basePosition: Vector2;     // 浮遊アニメの基準座標
  readonly colors: readonly string[]; // パーティクルの色（ポップ時に使用）
  opacity: number;                    // 0=不可視 → 1=通常 (フェードイン用)
  readonly floatPhase: number;
  readonly floatSpeed: number;
  readonly floatAmplitude: number;
  readonly imageIndex: number;        // 0〜9 (star-1.png〜star-10.png)
  readonly rotation: number;          // 初期回転角（ラジアン）— 違う星に見せるため
}

// ========== Particle System ==========

export type ParticleShape = 'sparkle' | 'dot';

export interface Particle {
  shape: ParticleShape;
  position: Vector2;
  velocity: Vector2;
  size: number;
  maxSize: number;
  color: string;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  life: number;       // 1.0 → 0.0
  decayRate: number;  // 毎秒減る life 量
}

export interface PopFlash {
  position: Vector2;
  radius: number;
  maxRadius: number;
  opacity: number;
}
