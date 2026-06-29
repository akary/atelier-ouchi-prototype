import type { PoseData } from '../types';

// TODO: MediaPipe 導入後にインポートを追加
// import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
// import { Camera } from '@mediapipe/camera_utils';

export class PoseTracker {
  private video: HTMLVideoElement;
  private latestPose: PoseData | null = null;
  private running = false;
  private rafId: number | null = null;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  async init(): Promise<void> {
    // TODO: MediaPipe Pose の初期化
    //   const pose = new Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
    //   pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5 });
    //   pose.onResults((results) => this.onResults(results));
    console.log('[PoseTracker] init (stub — MediaPipe 未接続)');
  }

  start(): void {
    this.running = true;
    this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  getLatestPose(): PoseData | null {
    return this.latestPose;
  }

  private tick(): void {
    if (!this.running) return;
    // TODO: MediaPipe にフレームを送る
    //   await pose.send({ image: this.video });
    void (this.video); // MediaPipe 接続後に使用
    this.rafId = requestAnimationFrame(() => this.tick());
  }

  // MediaPipe の onResults コールバックとして登録予定
  // pose.onResults((r) => this.handleResults(r));
  handleResults(_results: unknown): void {
    // TODO: results.poseLandmarks を PoseData 型に変換して latestPose にセット
  }
}
