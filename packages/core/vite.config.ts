import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ThreeMeshMerger',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`
    },
    rollupOptions: {
      external: ['three', 'three/examples/jsm/loaders/GLTFLoader', 'three/examples/jsm/exporters/GLTFExporter', 'three/examples/jsm/utils/BufferGeometryUtils'],
      output: {
        globals: {
          three: 'THREE'
        }
      }
    },
    sourcemap: true,
    minify: 'esbuild'
  }
})
