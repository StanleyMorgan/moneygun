// Fix: Add a triple-slash directive to include Node.js types for `process`.
/// <reference types="node" />

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

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
