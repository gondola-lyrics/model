import dts from 'vite-plugin-dts'

import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = import.meta.dirname
const src = resolve(root, 'src')
const gen = resolve(root, 'gen')

const runtimeSrc = resolve(src, 'runtime')
const storageSrc = resolve(src, 'storage')

export default defineConfig({
  resolve: {
    alias: {
      '@root': src,
      '@gen': gen,
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
    sourcemap: false,
    reportCompressedSize: false,
    lib: {
      entry: {
        index: resolve(src, 'index.ts'),
        common: resolve(src, 'common/index.ts'),
        runtime: resolve(runtimeSrc, 'index.ts'),
        storage: resolve(storageSrc, 'index.ts'),
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [/^@bufbuild\/protobuf/, './runtime', './storage'],
      // Lets an entry chunk absorb the modules it shares, so no hashed chunk is emitted beside it.
      preserveEntrySignatures: 'allow-extension',
      output: [
        {
          format: 'es',
          entryFileNames: '[name].mjs',
          chunkFileNames: '[name].mjs',
          paths: { [runtimeSrc]: './runtime.mjs', [storageSrc]: './storage.mjs' },
        },
        {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: '[name].cjs',
          paths: { [runtimeSrc]: './runtime.cjs', [storageSrc]: './storage.cjs' },
        },
      ],
    },
  },
})
