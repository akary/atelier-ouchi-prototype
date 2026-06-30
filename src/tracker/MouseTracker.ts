import type { Star, Vector2, IPositionTracker } from '../types';
import { distance } from '../utils/math';

// 当たり判定の倍率 (star.size の何倍以内でポップするか)
// 1歳の子ども向けなので大きめに設定
const HIT_RADIUS_FACTOR = 1.5;

export class MouseTracker implements IPositionTracker {
  private pos: Vector2;

  constructor(canvas: HTMLCanvasElement) {
    this.pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      this.pos = { x: e.clientX, y: e.clientY };
    });

    // スマホ・タブレット対応
    canvas.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) this.pos = { x: touch.clientX, y: touch.clientY };
      },
      { passive: false },
    );
  }

  // カーソルが重なっている星を1つ返す（最近傍）
  // opacity が低い（フェードイン途中）の星は対象外
  findCollision(stars: readonly Star[]): Star | null {
    let closest: Star | null = null;
    let closestDist = Infinity;

    for (const star of stars) {
      if (star.opacity < 0.5) continue; // フェードイン中は当たり判定なし
      const dist = distance(this.pos, star.position);
      if (dist < star.size * HIT_RADIUS_FACTOR && dist < closestDist) {
        closest     = star;
        closestDist = dist;
      }
    }

    return closest;
  }

  getPos(): Vector2 {
    return { ...this.pos };
  }
}
