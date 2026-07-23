import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:3000',
      },
    },
    globals: true,
    testTimeout: 10000,
    fileParallelism: false,
    // G3 flake fix (FASE 0 diagnosis): the worker RPC intermittently closed
    // while a console log was still pending at teardown
    // (EnvironmentTeardownError: Closing rpc while "onUserConsoleLog" was
    // pending), failing gate runs despite 178/178 green tests. No test in
    // the suite asserts intercepted console output, so disabling the
    // intercept removes the race without weakening any assertion.
    disableConsoleIntercept: true,
    setupFiles: ['./tests/setup.ts'],
    exclude: ['node_modules', '_fixpack_temp', 'dist'],
  },
});
