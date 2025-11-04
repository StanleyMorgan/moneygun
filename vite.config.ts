import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
// FIX: Explicitly import `process` to provide TypeScript with Node.js type definitions.
import { process } from 'node:process';

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