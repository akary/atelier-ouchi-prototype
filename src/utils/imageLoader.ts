import moonUrl       from '../images/moon.png';
import ladderUrl     from '../images/ladder.png';
import papaUrl       from '../images/papa.png';
import backgroundUrl from '../images/background.png';
import groundUrl     from '../images/ground.png';
import stoneUrl      from '../images/stone.png';

const starModules = import.meta.glob<{ default: string }>('../images/star-*.png', { eager: true });

export const STAR_IMAGE_COUNT = 10;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function loadStarImages(): Promise<HTMLImageElement[]> {
  const urls = Object.entries(starModules)
    .sort(([a], [b]) => {
      const na = parseInt(a.match(/star-(\d+)/)?.[1] ?? '0');
      const nb = parseInt(b.match(/star-(\d+)/)?.[1] ?? '0');
      return na - nb;
    })
    .map(([, mod]) => mod.default);

  return Promise.all(urls.map(loadImage));
}

export interface SceneImages {
  background: HTMLImageElement;
  moon:       HTMLImageElement;
  ladder:     HTMLImageElement;
  papa:       HTMLImageElement;
  ground:     HTMLImageElement;
  stone:      HTMLImageElement;
}

export async function loadSceneImages(): Promise<SceneImages> {
  const [background, moon, ladder, papa, ground, stone] = await Promise.all([
    loadImage(backgroundUrl),
    loadImage(moonUrl),
    loadImage(ladderUrl),
    loadImage(papaUrl),
    loadImage(groundUrl),
    loadImage(stoneUrl),
  ]);
  return { background, moon, ladder, papa, ground, stone };
}
