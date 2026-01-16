import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['lib/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}', '__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
    setupFiles: ['./vitest.setup.ts'],
    deps: {
      // 특정 모듈을 실제로 로드하지 않고 모킹만 사용
      inline: [
        /^@\/lib\/data\/studentPlans/,
        /^@\/lib\/data\/studentSessions/,
        /^@\/lib\/data\/planGroups/,
        /^@\/lib\/metrics\/studyTime/,
        /^@\/lib\/utils\/planUtils/,
        /^@\/lib\/utils\/dateUtils/,
      ],
    },
    // esbuild 설정
    esbuild: {
      target: 'node18',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
