import dts from 'vite-plugin-dts'

import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = import.meta.dirname

const entry = {
  index: resolve(root, 'src/index.ts'),
  'runtime/index': resolve(root, 'src/runtime/index.ts'),
  'storage/index': resolve(root, 'src/storage/index.ts'),
}

/**
 * Rewrites specifiers reaching the generated tree, which sits one level shallower in `dist` than in the source.
 * `entryRoot` flattens `src` away, so each layer's `.d.ts` lands one level above the source and needs `gen` rebased.
 */
const rebaseGenSpecifier = (content: string): string => content.replaceAll('../../gen/', '../gen/')

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
      entryRoot: resolve(root, 'src'),
      include: ['src', 'gen'],
      beforeWriteFile: (filePath, content) => ({
        filePath,
        content: rebaseGenSpecifier(content),
      }),
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
