import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const gatewayUrl = env.VITE_GATEWAY_URL ?? 'http://localhost:8080';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // Proxy ��� API �� ����� ����������
        proxy: {
          '/api': {
            target: gatewayUrl,
            changeOrigin: true,
            ws: false,
          },
        },
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

