import { CONTENTS, type ContentEntry } from '../contents';

// トップページ：コンテンツ選択画面。CONTENTS を元にカードを並べる。
function createCard(c: ContentEntry): HTMLElement {
  const clickable = c.ready !== false;
  const card = document.createElement(clickable ? 'a' : 'div');
  if (clickable && card instanceof HTMLAnchorElement) card.href = c.href;

  card.style.cssText = `
    position: relative; display: flex; flex-direction: column; gap: 10px;
    padding: 28px 24px; border-radius: 20px; text-decoration: none;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
    color: #fff; overflow: hidden; transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
    ${clickable ? 'cursor: pointer;' : 'opacity: 0.5; cursor: default;'}
  `;

  // アクセントの光
  const glow = document.createElement('div');
  glow.style.cssText = `position:absolute; top:-40px; right:-40px; width:140px; height:140px;
    border-radius:50%; background:${c.accent}; opacity:0.22; filter:blur(28px);`;
  card.appendChild(glow);

  const icon = document.createElement('div');
  icon.textContent = c.emoji;
  icon.style.cssText = `font-size:56px; line-height:1;`;

  const title = document.createElement('div');
  title.textContent = c.title;
  title.style.cssText = `font-size:22px; font-weight:700;`;

  const desc = document.createElement('div');
  desc.textContent = c.description;
  desc.style.cssText = `font-size:14px; line-height:1.6; color:rgba(255,255,255,0.72);`;

  card.append(icon, title, desc);

  if (!clickable) {
    const badge = document.createElement('div');
    badge.textContent = '準備中';
    badge.style.cssText = `align-self:flex-start; margin-top:4px; padding:3px 12px; border-radius:999px;
      font-size:12px; background:rgba(255,255,255,0.15);`;
    card.appendChild(badge);
  } else {
    // ホバーで少し浮かせる
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = `0 12px 40px rgba(0,0,0,0.35)`;
      card.style.background = 'rgba(255,255,255,0.1)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
      card.style.background = 'rgba(255,255,255,0.06)';
    });
  }

  return card;
}

function render(): void {
  const app = document.querySelector<HTMLElement>('#app');
  if (!app) return;

  const header = document.createElement('header');
  header.style.cssText = `text-align:center; margin-bottom:40px;`;
  const h1 = document.createElement('h1');
  h1.textContent = 'Atelier Ouchi';
  h1.style.cssText = `font-size:40px; font-weight:800; letter-spacing:0.04em; margin-bottom:8px;`;
  const sub = document.createElement('p');
  sub.textContent = 'あそびたいコンテンツをえらんでね';
  sub.style.cssText = `font-size:16px; color:rgba(255,255,255,0.7);`;
  header.append(h1, sub);

  const grid = document.createElement('div');
  grid.style.cssText = `display:grid; gap:20px; width:100%; max-width:960px;
    grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));`;
  for (const c of CONTENTS) grid.appendChild(createCard(c));

  app.append(header, grid);
}

render();
