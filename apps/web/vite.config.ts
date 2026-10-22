import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

// Which commit a build came from: shown nowhere to players; written into exported gameplay files so results can be tied to a version.
const appVersion = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
})();

export default defineConfig({
  // Relative asset URLs: the same build works at a domain root and under a GitHub Pages project path (/HumVAi/).
  base: './',
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [react()],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
});
