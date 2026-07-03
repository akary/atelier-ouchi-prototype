// ============================================================
// hand-touch — 手タッチ＋4点キャリブレの再利用モジュール
//
// 別コンテンツでの最小の使い方:
//
//   import { HandTracker, enterHandMode, createHandDebugPanel } from './hand-touch';
//
//   const hand = new HandTracker();               // カメラ＋MediaPipe Hands
//   let debug: ((c: CanvasRenderingContext2D) => void) | null = null;
//
//   startButton.onclick = () => enterHandMode(hand, {
//     onReady: () => {
//       active = true;                             // 以後 loop で hand.tick() を呼ぶ
//       debug = createHandDebugPanel(hand);        // 任意
//     },
//   });
//
//   // 毎フレーム:  hand.tick();
//   //             const hit = hand.findCollision(myObjects); // {position,size,opacity?} を満たす配列
//   //             const cursor = hand.getPos();
//
// 必要な静的アセット（public 配下、既定パス）:
//   public/mediapipe/wasm/*                    ← @mediapipe/tasks-vision/wasm をコピー
//   public/mediapipe/hand_landmarker.task      ← MediaPipe 配布モデル
// パスは HandTracker のオプション（wasmPath / modelPath）で変更可。
// ============================================================

export { HandTracker } from './HandTracker';
export type { HandTrackerOptions } from './HandTracker';
export type { Vec2, Hittable } from './types';
export { computeHomography, applyHomography } from './homography';
export type { Homography } from './homography';
export {
  enterHandMode,
  showHandSetup,
  showCalibration,
  createHandDebugPanel,
  createRecalibrateButton,
  loadCalibration,
  saveCalibration,
  clearCalibration,
} from './ui';
