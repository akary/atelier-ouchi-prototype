import type { Vector2, TrackerOutput } from '../../types';
import { distance, normalize, scale, add } from '../../utils/math';

const CANVAS_W = window.innerWidth;
const CANVAS_H = window.innerHeight;

export abstract class Creature {
  protected position: Vector2;
  protected velocity: Vector2 = { x: 0, y: 0 };
  protected color: string;

  constructor(x: number, y: number, color: string) {
    this.position = { x, y };
    this.color = color;
  }

  abstract update(tracker: TrackerOutput, deltaTime: number): void;
  abstract draw(ctx: CanvasRenderingContext2D): void;

  // 脅威となる座標から逃げる（全サブクラス共通）
  protected flee(threat: Vector2, fleeRadius: number, speed: number): void {
    const dist = distance(this.position, threat);
    if (dist >= fleeRadius || dist === 0) return;

    const strength = speed * (1 - dist / fleeRadius);
    const dir = normalize({
      x: this.position.x - threat.x,
      y: this.position.y - threat.y,
    });
    this.velocity = add(this.velocity, scale(dir, strength));
  }

  // 画面端でループ（CanvasサイズはRendererから渡す設計に将来変更可）
  protected wrapEdges(w: number = CANVAS_W, h: number = CANVAS_H): void {
    if (this.position.x < 0)  this.position.x += w;
    if (this.position.x > w)  this.position.x -= w;
    if (this.position.y < 0)  this.position.y += h;
    if (this.position.y > h)  this.position.y -= h;
  }
}
