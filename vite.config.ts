import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  const isProduction = command === 'build';

  return {
    // 本番（build）のときは相対パス './'、開発（dev）のときはルート '/'
    base: isProduction ? './' : '/', 
    build: {
      assetsInlineLimit: 0, // 画像を勝手にbase64化しない設定
    }
  };
});