import type { Star, Vector2 } from '../types';
import { hexToRGB } from './color';

// エリック・カールの絵本から抽出した鮮やかなパレット（複数色で塗り重ね）
const COLOR_SETS: readonly (readonly string[])[] = [
  ['#FFD700', '#FF8C00', '#FFA500'],   // 黄金の太陽
  ['#FF5252', '#C0392B', '#FF1744'],   // 深いサンゴ赤
  ['#B388FF', '#651FFF', '#7C4DFF'],   // ラベンダー
  ['#69F0AE', '#00BFA5', '#1DE9B6'],   // フォレストミント
  ['#FFD740', '#FF6D00', '#FF9100'],   // 琥珀オレンジ
  ['#FF80AB', '#F50057', '#FF4081'],   // マゼンタピンク
  ['#82B1FF', '#2979FF', '#448AFF'],   // スカイブルー
  ['#CCFF90', '#76FF03', '#64DD17'],   // 葉のグリーン
];

// 不規則な5芒星ポリゴンを生成（正規化座標 -1〜1）
function makeStarPoints(): Vector2[] {
  const pts: Vector2[] = [];
  const spikes = 5;
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const outer = i % 2 === 0;
    // 外側の点は 0.75〜1.0、内側は 0.35〜0.48 でランダムに揺らす
    const baseR = outer
      ? 0.88 + (Math.random() - 0.5) * 0.24
      : 0.42 + (Math.random() - 0.5) * 0.12;
    const jitteredAngle = angle + (Math.random() - 0.5) * 0.22;
    pts.push({
      x: Math.cos(jitteredAngle) * baseR,
      y: Math.sin(jitteredAngle) * baseR,
    });
  }
  return pts;
}

// OffscreenCanvas にエリック・カール風の貼り絵テクスチャを描画
function renderStarTexture(
  size: number,
  colors: readonly string[],
  points: Vector2[],
): OffscreenCanvas {
  const total = Math.ceil(size * 2.4); // 影・グロー分のパディング
  const canvas = new OffscreenCanvas(total, total);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2D context 取得失敗');

  const cx = total / 2;
  const cy = total / 2;

  // 星形パスを生成するヘルパー
  const starPath = (scale = 1, ox = 0, oy = 0): void => {
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      const x = cx + ox + p.x * size * scale;
      const y = cy + oy + p.y * size * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  // ---- Pass 1: 落とし影（切り絵の奥行き感） ----
  starPath(0.97, 5, 6);
  ctx.fillStyle = 'rgba(0, 0, 30, 0.38)';
  ctx.fill();

  // ---- Pass 2〜8: 貼り絵の塗り重ねレイヤー ----
  // 各レイヤーをわずかにずらし・サイズ違いで重ねることで
  // エリック・カール特有の「塗り重ねた紙」感を再現する
  for (let layer = 0; layer < 8; layer++) {
    const t = layer / 7;
    const colorIdx = Math.min(
      Math.floor(t * colors.length),
      colors.length - 1,
    );
    const [r, g, b] = hexToRGB(colors[colorIdx] ?? '#FFD700');
    const alpha = layer === 0 ? 0.65 : 0.10 + t * 0.48;
    const scale = 1.06 - layer * 0.028;
    const ox = (Math.random() - 0.5) * size * 0.14;
    const oy = (Math.random() - 0.5) * size * 0.14;

    starPath(scale, ox, oy);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fill();
  }

  // ---- Pass 9: 水平ブラシストローク（エリック・カールの筆跡） ----
  // 星形でクリップし、内部に等間隔の水平線を引く
  ctx.save();
  starPath(0.86);
  ctx.clip();
  const topY = cy - size * 0.83;
  const botY = cy + size * 0.83;
  const rowHeight = 2.8;
  const rows = Math.ceil((botY - topY) / rowHeight);
  for (let i = 0; i < rows; i++) {
    const y = topY + i * rowHeight;
    const colorIdx = Math.min(
      Math.floor((i / rows) * colors.length),
      colors.length - 1,
    );
    const [r, g, b] = hexToRGB(colors[colorIdx] ?? '#FFD700');
    const alpha = 0.042 + Math.random() * 0.055;
    const strokeH = 1 + Math.random() * 2.2;
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fillRect(cx - size, y + Math.random() * 1.5, size * 2, strokeH);
  }
  ctx.restore();

  // ---- Pass 10: 紙の粒子テクスチャ（スティップル） ----
  ctx.save();
  starPath(0.84);
  ctx.clip();
  const grainCount = Math.floor(size * size * 0.22);
  for (let i = 0; i < grainCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * size * 0.82;
    const gx = cx + Math.cos(angle) * r;
    const gy = cy + Math.sin(angle) * r;
    if (Math.random() < 0.65) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.17})`;
    } else {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.09})`;
    }
    ctx.fillRect(gx, gy, 1.5, 1.5);
  }
  ctx.restore();

  // ---- Pass 11: 中央ハイライト（光が当たった紙の輝き） ----
  ctx.save();
  starPath(0.88);
  ctx.clip();
  const grd = ctx.createRadialGradient(
    cx - size * 0.18, cy - size * 0.22, 0,
    cx, cy, size * 0.95,
  );
  grd.addColorStop(0, 'rgba(255,255,230,0.30)');
  grd.addColorStop(0.55, 'rgba(255,255,230,0.06)');
  grd.addColorStop(1, 'rgba(255,255,230,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
  ctx.restore();

  return canvas;
}

export function createStar(id: number, x: number, y: number): Star {
  const size = 36 + Math.random() * 38; // 36〜74px
  const colorSet = COLOR_SETS[id % COLOR_SETS.length]!;
  const points = makeStarPoints();
  const texture = renderStarTexture(size, colorSet, points);

  return {
    id,
    position: { x, y },
    size,
    basePosition: { x, y },
    colors: colorSet,
    opacity: 0,   // 0 から始まり、フェードインする
    floatPhase: Math.random() * Math.PI * 2,
    floatSpeed: 0.38 + Math.random() * 0.32,
    floatAmplitude: 9 + Math.random() * 14,
    texture,
  };
}
