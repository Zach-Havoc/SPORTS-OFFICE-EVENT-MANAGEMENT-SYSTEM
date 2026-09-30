import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
      // No <Toaster /> is mounted (App.tsx), so toasts draw nothing; ship a
      // no-op instead of sonner. Tests use vitest.config.ts and keep sonner.
      sonner: path.resolve(__dirname, './src/app/lib/toastNoop.ts'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          if (
            id.includes('/react-router') ||
            id.includes('/react-dom') ||
            id.includes('/react/') ||
            id.includes('/scheduler/')
          ) {
            return 'react-vendor'
          }

          if (id.includes('@tanstack/react-query')) {
            return 'query-vendor'
          }

          // Radix and lucide are left to Rollup on purpose: forcing them into
          // one shared chunk made every visitor download every icon and
          // widget any page uses (~140 KB) before the first screen.

          // recharts and its dependency tree are left out of manualChunks
          // on purpose: DashboardKit already lazy-loads recharts via
          // route.lazy, so it keeps its own separate chunk.
        },
      },
    },
  },
})
