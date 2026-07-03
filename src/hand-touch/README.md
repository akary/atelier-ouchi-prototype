# hand-touch

手（MediaPipe Hands）で投影面をタッチする仕組みを、コンテンツ非依存で切り出した再利用モジュール。
カメラ映像の手を検出し、**4点キャリブレ（ホモグラフィ）**でプロジェクター投影面のスクリーン座標へ正しく変換する。

## 別コンテンツへの移植手順

1. **この `hand-touch/` フォルダごとコピー**する。
2. **静的アセットを `public/` に置く**（既定パス）:
   - `public/mediapipe/wasm/*` … `node_modules/@mediapipe/tasks-vision/wasm` の中身をコピー
   - `public/mediapipe/hand_landmarker.task` … MediaPipe 配布モデル
   - パスを変えたい場合は `new HandTracker({ wasmPath, modelPath })` で指定。
3. **依存を入れる**: `npm i @mediapipe/tasks-vision`
4. カメラ取得には **HTTPS** が必要（Vite なら `@vitejs/plugin-basic-ssl`）。

## 最小の使い方

```ts
import { HandTracker, enterHandMode, createHandDebugPanel } from './hand-touch';

const hand = new HandTracker();
let active = false;
let debug: ((c: CanvasRenderingContext2D) => void) | null = null;

startButton.onclick = () => enterHandMode(hand, {
  onReady: () => { active = true; debug = createHandDebugPanel(hand); },
});

function loop(ctx: CanvasRenderingContext2D) {
  if (active) {
    hand.tick();                                  // 毎フレーム手を更新
    const hit = hand.findCollision(myObjects);    // {position,size,opacity?} の配列
    if (hit) { /* hit を弾く等 */ }
    const cursor = hand.getPos();                 // 手のひら中心（カーソル表示用）
    if (debug) debug(ctx);
  }
  requestAnimationFrame(() => loop(ctx));
}
```

`enterHandMode` が「起動→(保存済みキャリブレ再利用 or 4点キャリブレ)→再キャリブレボタン設置」まで面倒を見る。

## 当たり判定に使えるオブジェクト（Hittable）

```ts
interface Hittable { position: {x,y}; size: number; opacity?: number }
```

各コンテンツの「星」「風船」などがこれを満たしていれば `findCollision()` にそのまま渡せる。
`opacity` が 0.5 未満の要素は自動で当たり判定対象外（フェードイン中など）。

## API

| 種類 | 名前 | 役割 |
|---|---|---|
| class | `HandTracker` | カメラ＋手検出のコア。`init/tick/getPos/getTouchPoints/findCollision/setHomography` |
| fn | `enterHandMode` | 起動〜キャリブレ〜プレイ開始のワンストップ導線 |
| fn | `showHandSetup` | カメラ許可＋モデル読込オーバーレイ |
| fn | `showCalibration` | 4点キャリブレUI（結果は localStorage 保存） |
| fn | `createHandDebugPanel` | 映像プレビュー＋ランドマーク重畳（毎フレーム呼ぶ関数を返す） |
| fn | `createRecalibrateButton` | 再キャリブレ用の常設ボタン |
| fn | `load/save/clearCalibration` | キャリブレの永続化 |
| fn | `computeHomography` / `applyHomography` | 射影変換（低レベル） |

## 注意

- キャリブレは「カメラとプロジェクターの位置関係」に対して1回。**どちらかを動かしたら再キャリブレ**が必要。
- 深度は使っていないため、判定は「カメラ視点での2Dの重なり」。厳密な壁タッチ（かざしただけで反応しない）には深度センサーが要る。
