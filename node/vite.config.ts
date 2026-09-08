import dts from 'vite-plugin-dts'

import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = import.meta.dirname

const entry = {
  index: resolve(root, 'src/index.ts'),
}

export default defineConfig({
  resolve: {
    alias: {
      '@root': resolve(root, 'src'),
      '@gen': resolve(root, 'gen'),
    },
  },
  plugins: [
    dts({
      tsconfigPath: resolve(root, 'tsconfig.json'),
      include: ['src', 'gen'],
      bundleTypes: true,
    }),
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    reportCompressedSize: false,
    lib: {
      entry,
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [/^@bufbuild\/protobuf/],
    },
  },
})
