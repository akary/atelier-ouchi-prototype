import { NightSkyRenderer } from './renderer/NightSkyRenderer';
import { MouseTracker } from './tracker/MouseTracker';
import { createStar } from './utils/starFactory';
import {
  createSparkleParticles,
  createPopFlash,
  updateParticles,
  updateFlashes,
} from './utils/particleFactory';
import type { Star, Particle, PopFlash, Vector2 } from './types';

const STAR_COUNT   = 10;
const RESPAWN_DELAY_MS = 900; // ポップ後何ms で新しい星が出るか
const FADEIN_SPEED  = 1.4;   // 毎秒どれだけ opacity が増えるか（1/speed 秒でフェードイン）

// ---- 星の初期配置 ----
function spawnStars(count: number): Star[] {
  const margin = 120;
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Array.from({ length: count }, (_, i) => {
    const x = margin + Math.random() * (w - margin * 2);
    const y = margin + Math.random() * (h - margin * 2);
    const star = createStar(i, x, y);
    star.opacity = 1; // 初期スポーンはいきなり表示
    return star;
  });
}

// カーソルから minDist 以上離れた場所にスポーンする
function spawnOnestar(existingCount: number, mousePos: Vector2): Star {
  const margin    = 120;
  const minDist   = 220;
  const w = window.innerWidth;
  const h = window.innerHeight;
  let x: number, y: number, tries = 0;
  do {
    x = margin + Math.random() * (w - margin * 2);
    y = margin + Math.random() * (h - margin * 2);
    tries++;
  } while (
    Math.hypot(x - mousePos.x, y - mousePos.y) < minDist &&
    tries < 30
  );
  return createStar(existingCount % 8, x, y); // opacity = 0 でフェードイン開始
}

// ---- メインループ ----
function main(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
  if (!canvas) throw new Error('#canvas 要素が見つかりません');

  const stars: Star[]      = spawnStars(STAR_COUNT);
  const particles: Particle[] = [];
  const flashes: PopFlash[]   = [];
  const respawnQueue: number[] = []; // リスポーンを実行すべき timestamp (ms) のリスト

  const renderer    = new NightSkyRenderer(canvas);
  const mouseTracker = new MouseTracker(canvas);

  let lastTime = 0;

  function loop(timeMs: number): void {
    const deltaSec = Math.min((timeMs - lastTime) / 1000, 0.1); // 最大 100ms でクランプ
    lastTime = timeMs;

    const mousePos = mouseTracker.getPos();

    // ---- 当たり判定 → ポップ ----
    const hit = mouseTracker.findCollision(stars);
    if (hit) {
      particles.push(...createSparkleParticles(hit));
      flashes.push(createPopFlash(hit));
      stars.splice(stars.indexOf(hit), 1);
      respawnQueue.push(timeMs + RESPAWN_DELAY_MS);
    }

    // ---- パーティクル更新 ----
    updateParticles(particles, deltaSec);
    updateFlashes(flashes, deltaSec);
    // 死んだパーティクル・フラッシュを取り除く
    const livingParticles = particles.filter(p => p.life > 0);
    const livingFlashes   = flashes.filter(f => f.opacity > 0);
    particles.length = 0; particles.push(...livingParticles);
    flashes.length   = 0; flashes.push(...livingFlashes);

    // ---- リスポーン ----
    let i = 0;
    while (i < respawnQueue.length) {
      if (timeMs >= (respawnQueue[i] ?? 0)) {
        respawnQueue.splice(i, 1);
        stars.push(spawnOnestar(stars.length, mousePos));
      } else {
        i++;
      }
    }

    // ---- 星の更新（浮遊 + フェードイン） ----
    const timeSec = timeMs / 1000;
    for (const star of stars) {
      // フェードイン
      if (star.opacity < 1) {
        star.opacity = Math.min(1, star.opacity + FADEIN_SPEED * deltaSec);
      }

      // 浮遊アニメーション（フェードイン中でも動かす）
      const floatX =
        Math.cos(timeSec * star.floatSpeed * 0.65 + star.floatPhase) *
        star.floatAmplitude * 0.45;
      const floatY =
        Math.sin(timeSec * star.floatSpeed + star.floatPhase) *
        star.floatAmplitude;
      star.position.x = star.basePosition.x + floatX;
      star.position.y = star.basePosition.y + floatY;
    }

    // ---- 描画 ----
    renderer.draw(stars, particles, flashes, mousePos);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
  console.log('[main] 起動完了');
}

main();
