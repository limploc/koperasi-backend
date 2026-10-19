import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import dotenv from 'dotenv';

// Load test environment first, fallback to .env for shared configuration
dotenv.config({ path: '.env.test' });
dotenv.config({ path: '.env' });

const testDbUrl = process.env.DATABASE_URL_TEST;
const devDbUrl = process.env.DATABASE_URL;

if (!testDbUrl) {
  throw new Error(
    'E2E Test configuration error: DATABASE_URL_TEST is not set. Ensure .env.test is configured with a dedicated test database.',
  );
}

if (devDbUrl && testDbUrl === devDbUrl) {
  throw new Error(
    'E2E Test safety violation: DATABASE_URL_TEST cannot point to the development database (DATABASE_URL).',
  );
}

// Explicitly set DATABASE_URL and REDIS_URL for test processes to the test instances
process.env.DATABASE_URL = testDbUrl;
if (process.env.REDIS_URL_TEST) {
  process.env.REDIS_URL = process.env.REDIS_URL_TEST;
}

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
