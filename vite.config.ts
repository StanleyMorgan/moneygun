import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
// FIX: The explicit import of `process` is removed to rely on the global `process`
// object, which resolves type errors with `process.cwd()`.
// import process from 'node:process';

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
