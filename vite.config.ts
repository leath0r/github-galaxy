import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base must match the GitHub Pages sub-path (leath0r.github.io/github-galaxy)
export default defineConfig({
  base: '/github-galaxy/',
  plugins: [react(), tailwindcss()],
})
