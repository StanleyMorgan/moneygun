import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
// Fix: Explicitly import `process` to ensure correct Node.js types are used for `process.cwd()`.
import process from 'process';

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