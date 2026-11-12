import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const root = import.meta.dirname
const src = resolve(root, 'src')
const out = resolve(root, 'dist')

const enrichedSrc = resolve(src, 'enriched')
const documentSrc = resolve(src, 'document')

export default defineConfig({
  resolve: {
    alias: {
      '@root': src,
    },
  },
  plugins: [
    dts({
      tsconfigPath: resolve(root, 'tsconfig.json'),
      // Roots the per-file declarations at dist/src while bundling, so `../common` in them cannot resolve to the bundled dist/common.d.ts and declare the enums twice.
      entryRoot: root,
      include: ['src'],
      bundleTypes: true,
      outDirs: [{ dir: out }],
      beforeWriteFile: (filePath) => {
        if (resolve(filePath) !== resolve(out, 'index.d.ts')) {
          return
        }
        // Re-export the entry declarations so root and subpath imports share enum identities.
        return {
          content: "export * as document from './document.js'\nexport * as enriched from './enriched.js'\n\nexport * from './version.js'\n",
        }
      },
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
      entry: {
        index: resolve(src, 'index.ts'),
        common: resolve(src, 'common/index.ts'),
        enriched: resolve(enrichedSrc, 'index.ts'),
        document: resolve(documentSrc, 'index.ts'),
        version: resolve(src, 'version.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['./enriched', './document'],
      // Lets an entry chunk absorb the modules it shares, so no hashed chunk is emitted beside it.
      preserveEntrySignatures: 'allow-extension',
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        paths: { [enrichedSrc]: './enriched.js', [documentSrc]: './document.js' },
      },
    },
  },
})
