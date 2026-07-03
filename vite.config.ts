import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    basicSsl(), // スマホカメラ取得にはHTTPS必須
  ],
  server: {
    host: true,   // LAN上の他デバイス（スマホ）からアクセス可能にする
    port: 5173,
  },
  build: {
    rollupOptions: {
      // マルチページ：トップと各コンテンツの HTML をエントリに登録する。
      // コンテンツを増やしたらここに1行足す（<content-id>/index.html）。
      input: {
        top: 'index.html',
        'star-catch': 'star-catch/index.html',
      },
    },
  },
});
