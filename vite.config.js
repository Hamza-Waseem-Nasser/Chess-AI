import { defineConfig } from 'vite';

export default defineConfig({
  // Root directory where index.html lives
  root: '.',

  // Public directory for static assets (images, sounds)
  publicDir: 'public',

  // Dev server configuration
  server: {
    port: 3000,      // http://localhost:3000
    open: true,       // Auto-open browser when you run `npm run dev`
  },

  // Production build output
  build: {
    outDir: 'dist',   // Output folder
    emptyOutDir: true, // Clean dist/ before each build
  },
});
