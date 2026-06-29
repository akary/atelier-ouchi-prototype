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
}

// Renderer が毎フレーム受け取る合成出力
export interface TrackerOutput {
  pose: PoseData | null;
  shadow: ShadowData | null;
}

// ========== Star Catch Scene ==========

export interface Star {
  readonly id: number;
  position: Vector2;
  readonly size: number;
  readonly basePosition: Vector2;     // 浮遊アニメの基準座標
  readonly colors: readonly string[]; // エリック・カール用カラーセット
  opacity: number;                    // 0=不可視 → 1=通常 (フェードイン用)
  readonly floatPhase: number;
  readonly floatSpeed: number;
  readonly floatAmplitude: number;
  readonly texture: OffscreenCanvas;  // 事前レンダリングしたテクスチャ
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
