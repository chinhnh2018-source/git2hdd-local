import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // ESM support
    environment: 'node',
    // Include both unit and property tests
    include: [
      'test/unit/**/*.test.js',
      'test/property/**/*.test.js',
    ],
    // Globals for describe/it/expect
    globals: false,
    // Reporter
    reporter: 'verbose',
  },
})
