import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            include: ['src/**/*.test.{ts,tsx}'],
            exclude: ['src/**/*.slow.test.{ts,tsx}'],
            environment: 'node',
          },
        },
        {
          // Exhaustive checks (e.g. all 133,784,560 seven-card hands); run via `npm run test:slow`.
          extends: true,
          test: {
            name: 'slow',
            include: ['src/**/*.slow.test.{ts,tsx}'],
            environment: 'node',
            testTimeout: 600_000,
          },
        },
      ],
      benchmark: {
        include: ['src/**/*.bench.ts'],
      },
      coverage: {
        provider: 'v8',
        include: ['src/engine/**'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.bench.ts'],
      },
    },
  }),
)
