import { HandTracker } from './HandTracker';
import { computeHomography, type Homography } from './homography';
import type { Vec2 } from './types';

// ============================================================
// hand-touch モジュールの UI（セットアップ / キャリブレ / デバッグ）
// すべてアプリ非依存。DOM に直接オーバーレイを生成する。
// ============================================================

// ---- キャリブレ結果の永続化（同じ物理設置なら使い回せる）----
const CALIBRATION_KEY = 'atelier-hand-homography';

export function loadCalibration(key = CALIBRATION_KEY): Homography | null {
  try {
    const s = localStorage.getItem(key);
    if (!s) return null;
    const a = JSON.parse(s);
    return Array.isArray(a) && a.length === 9 ? (a as Homography) : null;
  } catch {
    return null;
  }
}

export function saveCalibration(H: Homography, key = CALIBRATION_KEY): void {
  try { localStorage.setItem(key, JSON.stringify(H)); } catch { /* 無視 */ }
}

export function clearCalibration(key = CALIBRATION_KEY): void {
  try { localStorage.removeItem(key); } catch { /* 無視 */ }
}

// ---- 起動セットアップ（カメラ許可＋モデル読込）----
export function showHandSetup(handTracker: HandTracker, onReady: () => void): void {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(4,12,46,0.82); backdrop-filter:blur(6px);
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:24px; z-index:100; color:#fff; font-family:sans-serif;`;

  const status = document.createElement('p');
  status.style.cssText = `margin:0; font-size:18px; text-align:center; line-height:1.6; white-space:pre-line;`;
  status.textContent = '手をかざして星に触れると弾けます';

  const btn = document.createElement('button');
  btn.textContent = '✋ 手あそびを始める';
  btn.style.cssText = `
    padding:14px 32px; font-size:18px; border-radius:40px; cursor:pointer;
    background:rgba(255,255,255,0.15); color:#fff;
    border:2px solid rgba(255,255,255,0.4); backdrop-filter:blur(4px);`;

  overlay.append(status, btn);
  document.body.appendChild(overlay);

  btn.addEventListener('click', async () => {
    btn.remove();
    try {
      status.textContent = '読み込み中…\n（カメラ起動＋手認識モデル）';
      await handTracker.init();
      status.textContent = '✨ スタート！';
      await new Promise((r) => setTimeout(r, 500));
      overlay.remove();
      onReady();
    } catch (err) {
      status.textContent = '起動に失敗しました。\nカメラ権限とネットワークを確認してください。';
      console.error('[hand-touch] setup', err);
    }
  });
}

// ---- 4点キャリブレ ----
// 壁（＝投影）の四隅マーカーを、カメラ映像の中でクリックして対応づける。
export function showCalibration(
  handTracker: HandTracker,
  onDone: () => void,
  key = CALIBRATION_KEY,
): void {
  const W = window.innerWidth, H = window.innerHeight;
  const CORNERS = [
    { label: '①', name: '左上', pos: { x: 0, y: 0 }, css: 'top:16px; left:16px;' },
    { label: '②', name: '右上', pos: { x: W, y: 0 }, css: 'top:16px; right:16px;' },
    { label: '③', name: '右下', pos: { x: W, y: H }, css: 'bottom:16px; right:16px;' },
    { label: '④', name: '左下', pos: { x: 0, y: H }, css: 'bottom:16px; left:16px;' },
  ];
  const dst = CORNERS.map(c => c.pos);
  let src: Vec2[] = [];

  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed; inset:0; z-index:300; font-family:sans-serif; color:#fff;
    background:rgba(4,12,46,0.55);`;

  const markerEls = CORNERS.map((c) => {
    const m = document.createElement('div');
    m.style.cssText = `position:fixed; ${c.css} width:84px; height:84px; box-sizing:border-box;
      border:5px solid rgba(255,255,255,0.45); border-radius:10px; transition:all .15s;
      display:flex; align-items:center; justify-content:center; font-size:34px; font-weight:bold;
      background:rgba(0,0,0,0.35);`;
    m.textContent = c.label;
    overlay.appendChild(m);
    return m;
  });

  const panel = document.createElement('div');
  panel.style.cssText = `position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
    background:rgba(0,0,0,0.75); padding:18px; border-radius:14px; display:flex; flex-direction:column;
    align-items:center; gap:12px; box-shadow:0 8px 40px rgba(0,0,0,0.5);`;

  const instruction = document.createElement('p');
  instruction.style.cssText = `margin:0; font-size:17px; text-align:center; line-height:1.5;`;

  const video = handTracker.getVideoElement();
  const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
  const dispW = Math.min(560, window.innerWidth * 0.6);
  const dispH = dispW * (vh / vw);
  const cam = document.createElement('canvas');
  cam.width = vw; cam.height = vh;
  cam.style.cssText = `width:${dispW}px; height:${dispH}px; border-radius:8px; cursor:crosshair;
    border:2px solid rgba(255,255,255,0.3); display:block;`;
  const camCtx = cam.getContext('2d')!;

  const btnRow = document.createElement('div');
  btnRow.style.cssText = `display:flex; gap:10px;`;
  const redoBtn = document.createElement('button');
  redoBtn.textContent = '↩ やり直す';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '✕ キャンセル';
  for (const b of [redoBtn, cancelBtn]) {
    b.style.cssText = `padding:8px 18px; font-size:14px; border-radius:24px; cursor:pointer;
      background:rgba(255,255,255,0.12); color:#fff; border:1px solid rgba(255,255,255,0.3);`;
  }
  btnRow.append(redoBtn, cancelBtn);
  panel.append(instruction, cam, btnRow);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  let rafId = 0;
  const drawLoop = () => {
    camCtx.drawImage(video, 0, 0, cam.width, cam.height);
    for (let i = 0; i < src.length; i++) {
      const px = src[i]!.x * cam.width, py = src[i]!.y * cam.height;
      camCtx.fillStyle = 'rgba(80,220,120,0.95)';
      camCtx.beginPath(); camCtx.arc(px, py, 9, 0, Math.PI * 2); camCtx.fill();
      camCtx.fillStyle = '#04122e'; camCtx.font = 'bold 13px sans-serif';
      camCtx.textAlign = 'center'; camCtx.textBaseline = 'middle';
      camCtx.fillText(CORNERS[i]!.label, px, py);
    }
    rafId = requestAnimationFrame(drawLoop);
  };
  drawLoop();

  function highlight(): void {
    markerEls.forEach((m, i) => {
      const active = i === src.length;
      m.style.borderColor = active ? 'rgba(80,220,120,1)' : 'rgba(255,255,255,0.35)';
      m.style.background  = active ? 'rgba(40,150,80,0.7)' : 'rgba(0,0,0,0.3)';
      m.style.transform   = active ? 'scale(1.15)' : 'scale(1)';
    });
    const cur = CORNERS[src.length];
    instruction.textContent = cur
      ? `壁で光っている ${cur.label}（${cur.name}）の角を\nこの映像の中でクリックしてください`
      : '完了！';
  }

  function finish(): void {
    cancelAnimationFrame(rafId);
    const Hmg = computeHomography(src, dst);
    handTracker.setHomography(Hmg);
    saveCalibration(Hmg, key);
    overlay.remove();
    onDone();
  }

  cam.addEventListener('click', (e: MouseEvent) => {
    if (src.length >= 4) return;
    const rect = cam.getBoundingClientRect();
    const nx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const ny = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    src.push({ x: nx, y: ny });
    if (src.length === 4) finish();
    else highlight();
  });

  redoBtn.addEventListener('click', () => { src = []; highlight(); });
  cancelBtn.addEventListener('click', () => { cancelAnimationFrame(rafId); overlay.remove(); onDone(); });

  highlight();
}

// ---- デバッグパネル（映像プレビュー＋ランドマークをメイン画面に重畳）----
// 返り値をメインループから毎フレーム呼ぶと、渡した ctx に手の点を描く。
export function createHandDebugPanel(
  handTracker: HandTracker,
): (mainCtx: CanvasRenderingContext2D) => void {
  const DISP_W = 160, DISP_H = 120;

  const panel = document.createElement('div');
  panel.style.cssText = `position:fixed; bottom:12px; left:12px; z-index:200;
    display:flex; gap:8px; align-items:flex-end;
    font-family:monospace; font-size:11px; color:rgba(255,255,255,0.75);`;

  const video = handTracker.getVideoElement();
  video.style.cssText = `display:block; width:${DISP_W}px; height:${DISP_H}px;
    object-fit:cover; border-radius:6px; border:1px solid rgba(255,255,255,0.3);`;
  const v = document.createElement('div');
  const vLbl = document.createElement('div');
  vLbl.textContent = 'カメラ映像';
  v.append(vLbl, video);

  const infoLine = document.createElement('div');
  infoLine.style.cssText = `white-space:pre; line-height:1.5; padding:6px 8px;
    background:rgba(0,0,0,0.5); border-radius:6px;`;
  panel.append(v, infoLine);
  document.body.appendChild(panel);

  return (mainCtx: CanvasRenderingContext2D) => {
    const hands = handTracker.getLastHands();
    infoLine.textContent =
      `hands: ${hands.length}\n` +
      `calibrated: ${handTracker.hasHomography() ? 'yes' : 'no'}`;

    mainCtx.save();
    for (const hand of hands) {
      mainCtx.fillStyle = 'rgba(0,220,255,0.75)';
      for (const p of hand) {
        mainCtx.beginPath();
        mainCtx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        mainCtx.fill();
      }
    }
    const pos = handTracker.getPos();
    if (pos.x > -1000) {
      mainCtx.strokeStyle = 'rgba(255,0,200,0.95)';
      mainCtx.lineWidth = 3;
      mainCtx.beginPath();
      mainCtx.arc(pos.x, pos.y, 40, 0, Math.PI * 2);
      mainCtx.stroke();
    }
    mainCtx.restore();
  };
}

// ---- 再キャリブレ用の常設ボタン ----
export function createRecalibrateButton(
  handTracker: HandTracker,
  onDone: () => void,
  opts: { rightPx?: number; bottomPx?: number; key?: string } = {},
): void {
  const rightPx = opts.rightPx ?? 20;
  const bottomPx = opts.bottomPx ?? 68;
  const btn = document.createElement('button');
  btn.textContent = '🎯 位置合わせ';
  btn.style.cssText = `position:fixed; bottom:${bottomPx}px; right:${rightPx}px; z-index:50;
    padding:10px 20px; font-size:14px; border-radius:30px; cursor:pointer;
    background:rgba(255,255,255,0.12); color:#fff;
    border:1px solid rgba(255,255,255,0.3); backdrop-filter:blur(4px);`;
  btn.addEventListener('click', () => {
    showCalibration(handTracker, onDone, opts.key ?? CALIBRATION_KEY);
  });
  document.body.appendChild(btn);
}

/**
 * 手モード開始のワンストップ導線：セットアップ → (保存済みキャリブレがあれば再利用 /
 * なければ4点キャリブレ) → onReady。再キャリブレボタンも自動で設置する。
 *
 * 新しいコンテンツではこれ1つ呼ぶだけで手タッチが使える。
 */
export function enterHandMode(
  handTracker: HandTracker,
  opts: {
    onReady: () => void;
    autoCalibrateIfUnset?: boolean; // 既定 true
    key?: string;
    showRecalibrateButton?: boolean; // 既定 true
  },
): void {
  const key = opts.key ?? CALIBRATION_KEY;
  showHandSetup(handTracker, () => {
    const saved = loadCalibration(key);
    if (saved) handTracker.setHomography(saved);
    if (opts.showRecalibrateButton !== false) {
      createRecalibrateButton(handTracker, opts.onReady, { key });
    }
    if (saved || opts.autoCalibrateIfUnset === false) opts.onReady();
    else showCalibration(handTracker, opts.onReady, key);
  });
}
