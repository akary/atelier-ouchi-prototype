import { NightSkyRenderer } from './renderer/NightSkyRenderer';
import { MouseTracker } from './tracker/MouseTracker';
import { CameraTracker } from './tracker/CameraTracker';
import { createStar } from './utils/starFactory';
import {
  createSparkleParticles,
  createPopFlash,
  updateParticles,
  updateFlashes,
} from './utils/particleFactory';
import type { Star, Particle, PopFlash, Vector2, IPositionTracker } from './types';

const STAR_COUNT        = 10;
const RESPAWN_DELAY_MS  = 900;
const FADEIN_SPEED      = 1.4;

// ---- 星の配置 ----
function spawnStars(count: number): Star[] {
  const margin = 120;
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Array.from({ length: count }, (_, i) => {
    const star = createStar(i, margin + Math.random() * (w - margin * 2), margin + Math.random() * (h - margin * 2));
    star.opacity = 1;
    return star;
  });
}

function spawnOneStar(existingCount: number, mousePos: Vector2): Star {
  const margin = 120, minDist = 220;
  const w = window.innerWidth, h = window.innerHeight;
  let x = 0, y = 0, tries = 0;
  do {
    x = margin + Math.random() * (w - margin * 2);
    y = margin + Math.random() * (h - margin * 2);
  } while (Math.hypot(x - mousePos.x, y - mousePos.y) < minDist && ++tries < 30);
  return createStar(existingCount % 8, x, y);
}

// ---- カメラ切り替えUI ----
function showCameraSetup(cameraTracker: CameraTracker, onReady: () => void): void {
  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  // オーバーレイ
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(4,12,46,0.82); backdrop-filter:blur(6px);
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:24px; z-index:100; color:#fff; font-family:sans-serif;
  `;

  // カメラプレビュー
  const preview = cameraTracker.getVideoElement();
  preview.style.cssText = `
    width:240px; height:180px; border-radius:12px; object-fit:cover;
    border:2px solid rgba(255,255,255,0.3); display:none;
    transform:scaleX(-1); /* 左右反転して鏡像表示 */
  `;

  // ステータステキスト
  const status = document.createElement('p');
  status.style.cssText = `margin:0; font-size:18px; text-align:center; line-height:1.6; white-space:pre-line;`;
  status.textContent = 'カメラで遊ぶ準備をします';

  // 開始ボタン
  const btn = document.createElement('button');
  btn.textContent = '📷 カメラを起動する';
  btn.style.cssText = `
    padding:14px 32px; font-size:18px; border-radius:40px; cursor:pointer;
    background:rgba(255,255,255,0.15); color:#fff;
    border:2px solid rgba(255,255,255,0.4); backdrop-filter:blur(4px);
  `;

  overlay.append(preview, status, btn);
  document.body.appendChild(overlay);

  btn.addEventListener('click', async () => {
    btn.remove();

    try {
      status.textContent = 'カメラを起動中…';
      await cameraTracker.init();
      preview.style.display = 'block';

      // カウントダウン（この間、子どもに画角から出てもらう）
      for (let i = 3; i > 0; i--) {
        status.textContent = `${i}秒後に背景を記録します\n（画角から出てください）`;
        await sleep(1000);
      }

      cameraTracker.calibrate();
      status.textContent = '✨ スタート！';
      await sleep(600);

      overlay.remove();
      onReady();

    } catch (err) {
      status.textContent = 'カメラにアクセスできませんでした。\nブラウザの設定を確認してください。';
      console.error('[CameraSetup]', err);
    }
  });
}

// ---- デバッグパネル（カメラモード切り替え後に表示）----
// カメラ映像 / 影マスク / メイン画面上の中心マーカーをリアルタイム更新する関数を返す
function createDebugPanel(
  cameraTracker: CameraTracker,
): (mainCtx: CanvasRenderingContext2D) => void {
  const DISP_W = 160, DISP_H = 120;

  const panel = document.createElement('div');
  panel.style.cssText = `
    position:fixed; bottom:12px; left:12px; z-index:200;
    display:flex; gap:8px; align-items:flex-end;
    font-family:monospace; font-size:11px; color:rgba(255,255,255,0.75);
  `;

  // カメラ映像（setup overlay から移動してくる）
  // ※鏡像表示（scaleX(-1)）は見た目だけの反転。座標計算には影響しない
  const video = cameraTracker.getVideoElement();
  video.style.cssText = `
    display:block; width:${DISP_W}px; height:${DISP_H}px;
    object-fit:cover; border-radius:6px;
    border:1px solid rgba(255,255,255,0.3);
    transform:scaleX(-1);
  `;
  const v = document.createElement('div');
  const vLbl = document.createElement('div');
  vLbl.textContent = 'カメラ映像';
  v.append(vLbl, video);

  // 影マスクキャンバス（320×240 で描いて CSS で縮小表示）
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width  = 320;
  maskCanvas.height = 240;
  maskCanvas.style.cssText = `
    display:block; width:${DISP_W}px; height:${DISP_H}px;
    border-radius:6px; border:1px solid rgba(255,255,255,0.3);
    transform:scaleX(-1);
  `;
  const maskCtx = maskCanvas.getContext('2d')!;
  const m = document.createElement('div');
  const mLbl = document.createElement('div');
  mLbl.textContent = '影マスク（白=動体）';
  m.append(mLbl, maskCanvas);

  // 計算値を数値で表示する行（バグの場所を特定するため）
  const infoLine = document.createElement('div');
  infoLine.style.cssText = `
    white-space:pre; line-height:1.5; padding:6px 8px;
    background:rgba(0,0,0,0.5); border-radius:6px;
  `;

  panel.append(v, m, infoLine);
  document.body.appendChild(panel);

  // 毎フレームメインループから呼ぶ更新関数
  return (mainCtx: CanvasRenderingContext2D) => {
    // 影マスクを更新
    const data = cameraTracker.getLastShadowData();
    let bbText = 'bbox(cam): なし';
    if (data) {
      maskCtx.putImageData(data.mask, 0, 0);
      if (data.boundingBox) {
        const bb = data.boundingBox;
        // バウンディングボックス（緑）
        maskCtx.strokeStyle = '#00ff50';
        maskCtx.lineWidth   = 2;
        maskCtx.strokeRect(bb.x, bb.y, bb.width, bb.height);
        // 重心（赤）＝実際にトラッキングに使われている点
        maskCtx.fillStyle = '#ff3366';
        maskCtx.beginPath();
        maskCtx.arc(bb.centerX, bb.centerY, 5, 0, Math.PI * 2);
        maskCtx.fill();
        bbText = `bbox(cam): x${bb.x} y${bb.y} w${bb.width} h${bb.height}`;
      }
    }

    // メイン画面に影の中心マーカーを描画（大きく・目立つ色に変更）
    const pos = cameraTracker.getPos();
    const onScreen = pos.x > -1000 && pos.x < window.innerWidth + 1000;
    infoLine.textContent =
      `${bbText}\n` +
      `screen: x${Math.round(pos.x)} y${Math.round(pos.y)}\n` +
      `window: ${window.innerWidth}x${window.innerHeight}`;

    if (onScreen) {
      mainCtx.save();
      mainCtx.strokeStyle = 'rgba(255,0,200,0.95)';
      mainCtx.lineWidth   = 4;
      mainCtx.beginPath();
      mainCtx.arc(pos.x, pos.y, 60, 0, Math.PI * 2);
      mainCtx.stroke();
      mainCtx.fillStyle = 'rgba(255,0,200,1)';
      mainCtx.beginPath();
      mainCtx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
      mainCtx.fill();
      // 画面外に出ていても方向が分かるよう全画面に十字線も描く
      mainCtx.strokeStyle = 'rgba(255,0,200,0.4)';
      mainCtx.lineWidth = 1;
      mainCtx.beginPath();
      mainCtx.moveTo(pos.x, 0);
      mainCtx.lineTo(pos.x, window.innerHeight);
      mainCtx.moveTo(0, pos.y);
      mainCtx.lineTo(window.innerWidth, pos.y);
      mainCtx.stroke();
      mainCtx.restore();
    }
  };
}

// ---- カメラ切り替えボタン（常時表示）----
function createSwitchButton(onClick: () => void): void {
  const btn = document.createElement('button');
  btn.textContent = '📷 カメラ';
  btn.style.cssText = `
    position:fixed; bottom:20px; right:20px; z-index:50;
    padding:10px 20px; font-size:14px; border-radius:30px; cursor:pointer;
    background:rgba(255,255,255,0.12); color:#fff;
    border:1px solid rgba(255,255,255,0.3); backdrop-filter:blur(4px);
  `;
  btn.addEventListener('click', () => { btn.remove(); onClick(); });
  document.body.appendChild(btn);
}

// ---- メイン ----
function main(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
  if (!canvas) throw new Error('#canvas が見つかりません');

  const stars: Star[]         = spawnStars(STAR_COUNT);
  const particles: Particle[] = [];
  const flashes: PopFlash[]   = [];
  const respawnQueue: number[] = [];

  const renderer      = new NightSkyRenderer(canvas);
  const mouseTracker  = new MouseTracker(canvas);
  const cameraTracker = new CameraTracker(true); // flipX=true（背面カメラ想定）

  let tracker: IPositionTracker = mouseTracker;
  let lastTime = 0;
  let updateDebug: ((ctx: CanvasRenderingContext2D) => void) | null = null;
  const mainCtx = canvas.getContext('2d')!;

  // ---- ゲームループ ----
  function loop(timeMs: number): void {
    const deltaSec = Math.min((timeMs - lastTime) / 1000, 0.1);
    lastTime = timeMs;
    const timeSec  = timeMs / 1000;

    // カメラトラッカーが有効なら毎フレーム影を処理
    if (tracker === cameraTracker) cameraTracker.tick();

    const mousePos = tracker.getPos();

    // 当たり判定 → ポップ
    const hit = tracker.findCollision(stars);
    if (hit) {
      particles.push(...createSparkleParticles(hit));
      flashes.push(createPopFlash(hit));
      stars.splice(stars.indexOf(hit), 1);
      respawnQueue.push(timeMs + RESPAWN_DELAY_MS);
    }

    // パーティクル更新
    updateParticles(particles, deltaSec);
    updateFlashes(flashes, deltaSec);
    const liveP = particles.filter(p => p.life > 0);
    const liveF = flashes.filter(f => f.opacity > 0);
    particles.length = 0; particles.push(...liveP);
    flashes.length   = 0; flashes.push(...liveF);

    // リスポーン
    let i = 0;
    while (i < respawnQueue.length) {
      if (timeMs >= (respawnQueue[i] ?? 0)) {
        respawnQueue.splice(i, 1);
        stars.push(spawnOneStar(stars.length, mousePos));
      } else { i++; }
    }

    // 星の更新（フェードイン + 浮遊）
    for (const star of stars) {
      if (star.opacity < 1) star.opacity = Math.min(1, star.opacity + FADEIN_SPEED * deltaSec);
      star.position.x = star.basePosition.x + Math.cos(timeSec * star.floatSpeed * 0.65 + star.floatPhase) * star.floatAmplitude * 0.45;
      star.position.y = star.basePosition.y + Math.sin(timeSec * star.floatSpeed        + star.floatPhase) * star.floatAmplitude;
    }

    renderer.draw(stars, particles, flashes, mousePos);
    if (updateDebug) updateDebug(mainCtx);
    requestAnimationFrame(loop);
  }

  // カメラ切り替えボタン
  createSwitchButton(() => {
    showCameraSetup(cameraTracker, () => {
      tracker = cameraTracker;
      updateDebug = createDebugPanel(cameraTracker);
      console.log('[main] カメラモードに切り替え');
    });
  });

  requestAnimationFrame(loop);
  console.log('[main] 起動完了（マウスモード）');
}

main();
