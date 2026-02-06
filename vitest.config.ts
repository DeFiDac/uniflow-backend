import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/types/**',
        'src/bot.ts',           // Main entry point - tested manually
        'src/server.ts',        // Server integration - tested manually
        'src/api/routes.ts',    // API routes - integration tests needed
        'src/constants.ts',     // Constants - no logic to test
        'src/**/index.ts',      // Re-export files - no logic to test
      ],
      thresholds: {
        lines: 65,              // Reduced for network-dependent services
        functions: 70,
        branches: 70,
        statements: 65,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests'),
    },
  },
});
