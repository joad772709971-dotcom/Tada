import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: mode === 'production' ? './' : '/',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'firebase/firestore': path.resolve(__dirname, './src/firebase-wrapper.ts'),
      },
    },
    optimizeDeps: {
      exclude: ['firebase/firestore'],
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react-router-dom',
        'motion/react',
        'lucide-react',
        'firebase/app',
        'firebase/auth',
        '@firebase/firestore',
        'axios',
        'date-fns',
        'recharts',
        'papaparse',
        'idb',
        'pako',
        'uuid',
        'qrcode.react',
      ],
      holdUntilCrawlEnd: true,
    },
    esbuild: mode === 'production' ? {
      drop: ['console', 'debugger'],
      legalComments: 'none'
    } : {},
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      target: 'esnext',
      rollupOptions: {
        maxParallelFileOps: 1,
        cache: false,
      },
      chunkSizeWarningLimit: 10000,
    },
    server: {
      port: 3000,
      strictPort: true,
      host: '0.0.0.0',
      hmr: false,
      watch: {
        usePolling: false,
        ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**']
      }
    },
  };
});
