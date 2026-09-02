import dts from 'vite-plugin-dts'

import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = import.meta.dirname

const entry = {
  index: resolve(root, 'src/index.ts'),
  'common/index': resolve(root, 'src/common/index.ts'),
  'runtime/index': resolve(root, 'src/runtime/index.ts'),
  'storage/index': resolve(root, 'src/storage/index.ts'),
}

export default defineConfig({
  resolve: {
    alias: {
      '@root': resolve(root, 'src'),
    },
  },
  plugins: [
    dts({
      tsconfigPath: resolve(root, 'tsconfig.json'),
      entryRoot: resolve(root, 'src'),
      include: ['src'],
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
