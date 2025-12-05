const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // If using TypeScript with a baseUrl set to the root directory then you need the below for alias' to work
  moduleDirectories: ['node_modules', '<rootDir>/'],

  // Module name mapping for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Test environment
  testEnvironment: 'jest-environment-jsdom',

  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**/*',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/index.{js,jsx,ts,tsx}',
  ],

  // Coverage thresholds
  // Global thresholds disabled during early development (most files untested)
  // Per-file thresholds enforce coverage for components that have tests
  coverageThreshold: {
    // Tested components should maintain high coverage
    './src/components/LicenseVerificationForm.tsx': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Test patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Setup files
  setupFiles: ['<rootDir>/jest.polyfills.js'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
// The async config function allows next/jest to properly set up transform patterns
module.exports = async () => {
  const config = await createJestConfig(customJestConfig)()

  // Override transformIgnorePatterns to handle ESM packages
  // next/jest sets this, but we need to allow next-intl and use-intl through
  config.transformIgnorePatterns = [
    '/node_modules/(?!(next-intl|use-intl|@testing-library)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ]

  return config
}
