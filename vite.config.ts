import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves project sites from /<repo-name>/.
// The GitHub Actions workflow sets VITE_BASE automatically from the repo name.
// Locally (npm run dev / build) it falls back to "/" so everything just works.
// If you deploy to a custom domain or a <user>.github.io repo, leave VITE_BASE unset.
export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  plugins: [react()],
})
