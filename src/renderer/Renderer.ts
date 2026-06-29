import type { TrackerOutput } from '../types';
import { Fish } from './creatures/Fish';
import type { Creature } from './creatures/Creature';

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private creatures: Creature[] = [];
  private lastTime = 0;
  private rafId: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context 取得失敗');
    this.ctx = ctx;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  init(creatureCount = 15): void {
    this.creatures = Array.from({ length: creatureCount }, () =>
      new Fish(
        Math.random() * this.canvas.width,
        Math.random() * this.canvas.height,
      ),
    );
    console.log(`[Renderer] ${creatureCount} 匹の生き物を生成`);
  }

  // getTrackerOutput: 毎フレーム呼ばれるコールバック
  start(getTrackerOutput: () => TrackerOutput): void {
    const loop = (time: number): void => {
      const delta = time - this.lastTime;
      this.lastTime = time;
      this.update(getTrackerOutput(), delta);
      this.draw();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private update(output: TrackerOutput, delta: number): void {
    for (const creature of this.creatures) {
      creature.update(output, delta);
    }
  }

  private draw(): void {
    // 残像エフェクト（完全クリアではなく半透明で塗る）
    this.ctx.fillStyle = 'rgba(10, 20, 50, 0.18)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (const creature of this.creatures) {
      creature.draw(this.ctx);
    }
  }

  private resize(): void {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
}
