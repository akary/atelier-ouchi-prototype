// ============================================================
// コンテンツ登録表（トップページの一覧はここから生成される）
//
// 新しいコンテンツを増やすとき:
//   1. <content-id>/index.html を作り、そのコンテンツの main.ts を読み込む
//   2. この配列に1つ足す（href は上の HTML の URL）
//   3. vite.config.ts の build.rollupOptions.input にも同じ HTML を足す
// ============================================================

export interface ContentEntry {
  id: string;
  title: string;
  description: string;
  emoji: string;        // カードのアイコン（画像サムネに差し替えても良い）
  href: string;         // 遷移先ページ
  accent: string;       // カードのアクセント色
  ready?: boolean;      // false なら「準備中」表示（クリック不可）
}

export const CONTENTS: ContentEntry[] = [
  {
    id: 'star-catch',
    title: 'よぞらの星あつめ',
    description: '手をかざして、夜空の星にさわると弾けるよ',
    emoji: '🌙',
    href: '/star-catch/',
    accent: '#f5c542',
    ready: true,
  },
  // 例: 次のコンテンツを足すときのテンプレ
  // {
  //   id: 'bubble-pop', title: 'しゃぼんだまポップ',
  //   description: '手でしゃぼんだまをぱちんと割ろう',
  //   emoji: '🫧', href: '/bubble-pop/', accent: '#7ec8e3', ready: false,
  // },
];
