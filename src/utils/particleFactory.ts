import type { Particle, PopFlash, Star } from '../types';

// ポップ時に生成するパーティクル数
const PARTICLE_COUNT = 28;

export function createSparkleParticles(star: Star): Particle[] {
  const particles: Particle[] = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // 放射方向をほぼ均等に分散させる（+ 乱数で揺らす）
    const angle =
      (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
    const speed = 80 + Math.random() * 280;
    const isSparkle = Math.random() < 0.55; // 55% は4芒星、45% はドット

    // 色: 元の星の色 + 白・クリーム白を混ぜる（光が反射した紙片）
    const colorRoll = Math.random();
    let color: string;
    if (colorRoll < 0.18) {
      color = '#FFFFFF';
    } else if (colorRoll < 0.32) {
      color = '#FFFDE7'; // クリーム白
    } else {
      const idx = Math.floor(Math.random() * star.colors.length);
      color = star.colors[idx] ?? '#FFD700';
    }

    const maxSize = isSparkle
      ? 5 + Math.random() * 15   // 4芒星: 5〜20px
      : 2 + Math.random() * 5;   // ドット: 2〜7px

    particles.push({
      shape: isSparkle ? 'sparkle' : 'dot',
      position: {
        // 星の中心付近からバラけて発生
        x: star.position.x + (Math.random() - 0.5) * star.size * 0.5,
        y: star.position.y + (Math.random() - 0.5) * star.size * 0.5,
      },
      velocity: {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed - 40, // わずかに上向きバイアス
      },
      size: maxSize,
      maxSize,
      color,
      opacity: 1.0,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 9,
      life: 1.0,
      decayRate: 0.7 + Math.random() * 0.8,
    });
  }

  return particles;
}

export function createPopFlash(star: Star): PopFlash {
  return {
    position: { x: star.position.x, y: star.position.y },
    radius: star.size * 0.4,
    maxRadius: star.size * 2.8,
    opacity: 0.9,
  };
}

// ---- 毎フレームの更新処理 ----

export function updateParticles(
  particles: Particle[],
  deltaSec: number,
): void {
  for (const p of particles) {
    p.position.x += p.velocity.x * deltaSec;
    p.position.y += p.velocity.y * deltaSec;
    p.velocity.y += 90 * deltaSec; // 重力（紙片が落ちていく感じ）
    p.rotation   += p.rotationSpeed * deltaSec;
    p.life        = Math.max(0, p.life - p.decayRate * deltaSec);
    p.opacity     = p.life * p.life;           // quadratic fade-out
    p.size        = p.maxSize * Math.max(0, p.life);
  }
}

export function updateFlashes(flashes: PopFlash[], deltaSec: number): void {
  for (const f of flashes) {
    f.opacity -= deltaSec * 3.8; // 素早くフェード
    // maxRadius へ向けて一気に膨張
    f.radius += (f.maxRadius - f.radius) * Math.min(1, deltaSec * 12);
  }
}
