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
});
