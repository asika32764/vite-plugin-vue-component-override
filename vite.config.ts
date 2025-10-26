import { defineConfig } from 'vite';
import dts from 'unplugin-dts/vite';

export default defineConfig(({ mode }) => {
  return {
    build: {
      lib: {
        entry: [
          'src/index.ts',
          'src/plugin.ts'
        ],
        name: 'vueComponentOverride',
        formats: ['es'],
      },
      rollupOptions: {
        external: [
          'vite',
          'fs',
          'path',
          'vue',
        ]
      },
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
      minify: false,
    },
    plugins: [
      dts({
        tsconfigPath: 'tsconfig.json',
        insertTypesEntry: true,
      }),
    ]
  };
});
