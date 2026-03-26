import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
// 👇 1. 引入剛剛安裝的 PWA 套件
import { VitePWA } from 'vite-plugin-pwa'; 

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      // 👇 2. 把 PWA 的身分證加進 plugins 陣列裡 👇
      VitePWA({
        registerType: 'autoUpdate', // 自動更新 App
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'], // 你的靜態檔案
        manifest: {
          name: '哪有賭徒天天輸', // 安裝時顯示的完整名稱
          short_name: '哪有賭徒', // 手機桌面上顯示的短名稱 (太長會被截斷)
          description: '你的專屬麻將戰績與找咖神器',
          theme_color: '#ffffff', // App 頂部狀態列的顏色
          background_color: '#ffffff', // 剛打開時的背景色
          display: 'standalone', // 🌟 關鍵！這會隱藏 Safari 的網址列和底部導航列
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    // 👇 以下保留你原本的設定完全不動 👇
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});