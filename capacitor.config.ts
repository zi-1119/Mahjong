import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.your.app.id', // (這行保留你原本的)
  appName: '哪有賭徒天天輸🀄️', // (這行保留你原本的)
  webDir: 'dist',
  bundledWebRuntime: false,
  
  // 👇👇👇 加入這整段 server 設定 👇👇👇
  server: {
    iosScheme: 'https',
    androidScheme: 'https'
  }
};

export default config;