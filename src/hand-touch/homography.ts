import type { Vec2 } from './types';

// 3x3 射影変換行列を 9 要素の配列で表す（行優先）。
export type Homography = readonly number[];

// 8x8 連立一次方程式を部分ピボット付きガウス消去で解く。
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r]![col]!) > Math.abs(M[pivot]![col]!)) pivot = r;
    }
    [M[col], M[pivot]] = [M[pivot]!, M[col]!];

    const pivVal = M[col]![col]!;
    if (Math.abs(pivVal) < 1e-12) continue; // 退化（角がほぼ一直線）

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r]![col]! / pivVal;
      for (let c = col; c <= n; c++) M[r]![c]! -= factor * M[col]![c]!;
    }
  }

  return M.map((row, i) => row[n]! / row[i]!);
}

/**
 * 4 組の対応点から射影変換行列を求める。
 * @param src 変換元の 4 点（例：カメラ正規化座標）
 * @param dst 変換先の 4 点（例：スクリーン座標）。src と同じ順序で渡す。
 */
export function computeHomography(src: readonly Vec2[], dst: readonly Vec2[]): Homography {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: X, y: Y } = src[i]!;
    const { x: u, y: v } = dst[i]!;
    A.push([X, Y, 1, 0, 0, 0, -u * X, -u * Y]); b.push(u);
    A.push([0, 0, 0, X, Y, 1, -v * X, -v * Y]); b.push(v);
  }
  const h = solveLinear(A, b);
  return [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1];
}

/** 射影変換行列で 1 点を変換する。 */
export function applyHomography(H: Homography, p: Vec2): Vec2 {
  const d = H[6]! * p.x + H[7]! * p.y + H[8]!;
  return {
    x: (H[0]! * p.x + H[1]! * p.y + H[2]!) / d,
    y: (H[3]! * p.x + H[4]! * p.y + H[5]!) / d,
  };
}
