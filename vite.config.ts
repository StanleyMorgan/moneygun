import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
// FIX: Import `process` from `node:process` to provide the correct type definitions
// for the Node.js global `process` object, resolving the type error on `process.cwd()`.
// FIX: The `cwd` function is not a named export. Import the `process` object itself.
import process from 'node:process';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.REOWN_PROJECT_ID': JSON.stringify(env.REOWN_PROJECT_ID)
    }
  }
})