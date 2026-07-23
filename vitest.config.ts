import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@carerota/types': resolve(__dirname, 'packages/types/src/index.ts'),
      '@carerota/domain': resolve(__dirname, 'packages/domain/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
})
