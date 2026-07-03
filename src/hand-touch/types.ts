// ============================================================
// hand-touch モジュール共通型（アプリ非依存）
// ============================================================

export interface Vec2 {
  x: number;
  y: number;
}

// findCollision で当たり判定できるオブジェクトの最小形状。
// 各コンテンツの「星」「風船」などがこれを満たしていれば当たり判定に使える。
export interface Hittable {
  position: Vec2;
  size: number;
  opacity?: number; // 省略時は常に当たり判定対象
}
