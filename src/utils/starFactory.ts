import type { Star } from '../types';

// ポップ時のパーティクルに使うカラーセット（エリック・カール風）
const COLOR_SETS: readonly (readonly string[])[] = [
  ['#FFD700', '#FF8C00', '#FFA500'],
  ['#FF5252', '#C0392B', '#FF1744'],
  ['#B388FF', '#651FFF', '#7C4DFF'],
  ['#69F0AE', '#00BFA5', '#1DE9B6'],
  ['#FFD740', '#FF6D00', '#FF9100'],
  ['#FF80AB', '#F50057', '#FF4081'],
  ['#82B1FF', '#2979FF', '#448AFF'],
  ['#CCFF90', '#76FF03', '#64DD17'],
];

// star-6(index 5)・star-10(index 9) が全体の半数になるよう重み付け
const FEATURED = [5, 9] as const;
const OTHERS   = [0, 1, 2, 3, 4, 6, 7, 8] as const;

function pickImageIndex(): number {
  return Math.random() < 0.5
    ? FEATURED[Math.floor(Math.random() * FEATURED.length)]!
    : OTHERS[Math.floor(Math.random() * OTHERS.length)]!;
}

export function createStar(id: number, x: number, y: number): Star {
  const size = 20 + Math.random() * 30; // 20〜50px

  return {
    id,
    position:       { x, y },
    size,
    basePosition:   { x, y },
    colors:         COLOR_SETS[id % COLOR_SETS.length]!,
    opacity:        0,
    floatPhase:     Math.random() * Math.PI * 2,
    floatSpeed:     0.38 + Math.random() * 0.32,
    floatAmplitude: 9 + Math.random() * 14,
    imageIndex:     pickImageIndex(),
    rotation:       Math.random() * Math.PI * 2,
  };
}
