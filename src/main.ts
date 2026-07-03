import { NightSkyRenderer, MOON_CY, MOON_SIZE } from './renderer/NightSkyRenderer';
import { MouseTracker } from './tracker/MouseTracker';
import { CameraTracker } from './tracker/CameraTracker';
import { HandTracker, enterHandMode, createHandDebugPanel } from './hand-touch';
import { createStar } from './utils/starFactory';
import { loadStarImages, loadSceneImages } from './utils/imageLoader';
import {
  createSparkleParticles,
  createPopFlash,
  updateParticles,
  updateFlashes,
} from './utils/particleFactory';
import type { Star, Particle, PopFlash, Vector2, IPositionTracker } from './types';

const STAR_COUNT        = 30;
const RESPAWN_DELAY_MS  = 900;
const FADEIN_SPEED      = 1.4;

// ---- 星の配置 ----

// 指定エリアを格子分割してランダムジッターで n 点を生成する（重なり防止）
function gridPositions(n: number, x0: number, y0: number, x1: number, y1: number): Vector2[] {
  const W = x1 - x0;
  const H = y1 - y0;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * W / H)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const cellW = W / cols;
  const cellH = H / rows;

  const cells: Vector2[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        x: x0 + (c + 0.15 + Math.random() * 0.7) * cellW,
        y: y0 + (r + 0.15 + Math.random() * 0.7) * cellH,
      });
    }
  }
  // Fisher-Yates でシャッフルして n 個返す
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }
  return cells.slice(0, n);
}

// 月の円形エリアと重なっていないか判定（星の描画半径ぶん余白を加える）
function clearOfMoon(x: number, y: number): boolean {
  const moonCX = Math.round(window.innerWidth / 3);
  const exclusionR = MOON_SIZE / 2 + 80; // 月半径 + 星の最大描画半径
  return Math.hypot(x - moonCX, y - MOON_CY) > exclusionR;
}

function spawnStars(count: number, groundH: number): Star[] {
  const margin = 120;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const mid = h / 2;
  const bottom = h - groundH; // ground上端から40px上を下限に

  // 下半分 65%、上半分 35%
  const lowerCount = Math.round(count * 0.65);
  const upperCount = count - lowerCount;

  // 月と被る候補を除外するため多めに生成してフィルタリング
  function safePositions(n: number, x0: number, y0: number, x1: number, y1: number): Vector2[] {
    const result: Vector2[] = [];
    for (let attempt = 0; result.length < n && attempt < 8; attempt++) {
      const candidates = gridPositions(n * 2, x0, y0, x1, y1);
      for (const p of candidates) {
        if (result.length >= n) break;
        if (clearOfMoon(p.x, p.y)) result.push(p);
      }
    }
    return result.slice(0, n);
  }

  const positions = [
    ...safePositions(upperCount, margin, margin, w - margin, mid),
    ...safePositions(lowerCount, margin, mid,    w - margin, bottom),
  ];

  return positions.map((pos, i) => {
    const star = createStar(i, pos.x, pos.y);
    star.opacity = 1;
    return star;
  });
}

const STAR_MIN_DIST = 160; // 星同士の中心間最小距離

function spawnOneStar(existingCount: number, mousePos: Vector2, existing: readonly Star[], groundH: number): Star {
  const margin = 120, minDist = 220;
  const w = window.innerWidth, h = window.innerHeight;
  const bottom = h - groundH - 40;
  let x = 0, y = 0, tries = 0;
  do {
    x = margin + Math.random() * (w - margin * 2);
    // リスポーンも同じ分布（下65%）
    y = Math.random() < 0.65
      ? h / 2 + Math.random() * (bottom - h / 2)
      : margin  + Math.random() * (h / 2 - margin);
  } while (
    (
      Math.hypot(x - mousePos.x, y - mousePos.y) < minDist ||
      !clearOfMoon(x, y) ||
      existing.some(s => s.opacity > 0.1 && Math.hypot(x - s.position.x, y - s.position.y) < STAR_MIN_DIST)
    ) && ++tries < 40
  );
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
  const video = cameraTracker.getVideoElement();
  video.style.cssText = `
    display:block; width:${DISP_W}px; height:${DISP_H}px;
    object-fit:cover; border-radius:6px;
    border:1px solid rgba(255,255,255,0.3);
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


// ---- モード切り替えボタン（常時表示）----
// rightPx で複数ボタンを横並びにする。押されたら自分だけ消える。
function createSwitchButton(label: string, rightPx: number, onClick: () => void): void {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.style.cssText = `
    position:fixed; bottom:20px; right:${rightPx}px; z-index:50;
    padding:10px 20px; font-size:14px; border-radius:30px; cursor:pointer;
    background:rgba(255,255,255,0.12); color:#fff;
    border:1px solid rgba(255,255,255,0.3); backdrop-filter:blur(4px);
  `;
  btn.addEventListener('click', () => { btn.remove(); onClick(); });
  document.body.appendChild(btn);
}

// ---- メイン ----
async function main(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
  if (!canvas) throw new Error('#canvas が見つかりません');

  const [images, scene] = await Promise.all([loadStarImages(), loadSceneImages()]);

  const groundH = scene.ground.height * (window.innerWidth / scene.ground.width);
  const stars: Star[]         = spawnStars(STAR_COUNT, groundH);
  const particles: Particle[] = [];
  const flashes: PopFlash[]   = [];
  const respawnQueue: number[] = [];

  // パパが梯子を上る進捗（0=下端 〜 1=月の位置）
  let papaTarget   = 0;
  let papaProgress = 0;

  const renderer      = new NightSkyRenderer(canvas, images, scene);
  const mouseTracker  = new MouseTracker(canvas);
  const cameraTracker = new CameraTracker(false);
  const handTracker   = new HandTracker(); // 4点キャリブレで向き・歪みを補正するので flipX 不要

  let tracker: IPositionTracker = mouseTracker;
  let lastTime = 0;
  let updateDebug: ((ctx: CanvasRenderingContext2D) => void) | null = null;
  const mainCtx = canvas.getContext('2d')!;

  // ---- ゲームループ ----
  function loop(timeMs: number): void {
    const deltaSec = Math.min((timeMs - lastTime) / 1000, 0.1);
    lastTime = timeMs;
    const timeSec  = timeMs / 1000;

    // アクティブなトラッカーの毎フレーム処理
    if (tracker === cameraTracker) cameraTracker.tick();
    if (tracker === handTracker)   handTracker.tick();

    const mousePos = tracker.getPos();

    // 当たり判定 → ポップ
    const hit = tracker.findCollision(stars);
    if (hit) {
      particles.push(...createSparkleParticles(hit));
      flashes.push(createPopFlash(hit));
      stars.splice(stars.indexOf(hit), 1);
      respawnQueue.push(timeMs + RESPAWN_DELAY_MS);
      // 星をひとつ弾くたびにパパが少し上る
      papaTarget = Math.min(1, papaTarget + 0.008);
    }

    // パパをなめらかに目標位置へ近づける
    papaProgress += (papaTarget - papaProgress) * Math.min(1, deltaSec * 3);

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
        stars.push(spawnOneStar(stars.length, mousePos, stars, groundH));
      } else { i++; }
    }

    // 星の更新（フェードイン + 浮遊）
    for (const star of stars) {
      if (star.opacity < 1) star.opacity = Math.min(1, star.opacity + FADEIN_SPEED * deltaSec);
      star.position.x = star.basePosition.x + Math.cos(timeSec * star.floatSpeed * 0.65 + star.floatPhase) * star.floatAmplitude * 0.45;
      star.position.y = star.basePosition.y + Math.sin(timeSec * star.floatSpeed        + star.floatPhase) * star.floatAmplitude;
    }

    renderer.draw(stars, particles, flashes, mousePos, papaProgress);
    if (updateDebug) updateDebug(mainCtx);
    requestAnimationFrame(loop);
  }

  // 手モード切り替えボタン（本命：手で星に触れると弾ける）
  // 起動→キャリブレ→再キャリブレボタン設置まで hand-touch の enterHandMode に任せる。
  createSwitchButton('✋ 手あそび', 20, () => {
    enterHandMode(handTracker, {
      onReady: () => {
        tracker = handTracker;
        if (!updateDebug) updateDebug = createHandDebugPanel(handTracker);
        console.log('[main] 手モードに切り替え');
      },
    });
  });

  // 影モード切り替えボタン（従来の動体検知。比較用に残す）
  createSwitchButton('📷 影モード', 140, () => {
    showCameraSetup(cameraTracker, () => {
      tracker = cameraTracker;
      updateDebug = createDebugPanel(cameraTracker);
      console.log('[main] カメラモードに切り替え');
    });
  });

  requestAnimationFrame(loop);
  console.log('[main] 起動完了（マウスモード）');
}

main().catch(console.error);
