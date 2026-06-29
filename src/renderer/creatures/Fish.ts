import type { TrackerOutput, Vector2 } from '../../types';
import { Creature } from './Creature';

const PASTEL_COLORS = ['#AEE2FF', '#B5EAD7', '#FFDAC1', '#FFB7B2', '#E2F0CB', '#C9C9FF'];
const FLEE_RADIUS = 200;
const FLEE_SPEED  = 4;
const DAMPING     = 0.88;

export class Fish extends Creature {
  private readonly size: number;

  constructor(x: number, y: number) {
    const color = PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
    super(x, y, color ?? '#AEE2FF');
    this.size = 20 + Math.random() * 20;
  }

  update(tracker: TrackerOutput, _deltaTime: number): void {
    // 骨格ランドマーク（正規化座標 → スクリーン座標）から逃げる
    if (tracker.pose) {
      for (const lm of tracker.pose.landmarks) {
        if ((lm.visibility ?? 1) < 0.3) continue;
        const threat: Vector2 = {
          x: lm.x * window.innerWidth,
          y: lm.y * window.innerHeight,
        };
        this.flee(threat, FLEE_RADIUS, FLEE_SPEED);
      }
    }

    // 影（バウンディングボックス）の中心からも逃げる
    if (tracker.shadow?.boundingBox) {
      const bb = tracker.shadow.boundingBox;
      // ShadowTracker の座標は 640x480 なのでスクリーン比にスケール
      const threat: Vector2 = {
        x: (bb.x + bb.width  / 2) / 640 * window.innerWidth,
        y: (bb.y + bb.height / 2) / 480 * window.innerHeight,
      };
      this.flee(threat, FLEE_RADIUS * 1.5, FLEE_SPEED * 0.5);
    }

    // 速度減衰 → 位置更新 → 画面端ループ
    this.velocity.x *= DAMPING;
    this.velocity.y *= DAMPING;
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;
    this.wrapEdges();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { x, y } = this.position;

    ctx.save();
    ctx.translate(x, y);

    // 胴体
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size, this.size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 尾ひれ
    ctx.beginPath();
    ctx.moveTo(-this.size, 0);
    ctx.lineTo(-this.size * 1.6, -this.size * 0.45);
    ctx.lineTo(-this.size * 1.6,  this.size * 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
