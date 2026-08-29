import { defineConfig } from 'vitest/config';
import path from 'path';

//& mirror the '@/' -> src alias frm tsconfig so route/lib imports resolve in tests

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
  },
});
