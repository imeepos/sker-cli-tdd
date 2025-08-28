import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
  treeshake: true,
  bundle: true,
  skipNodeModulesBundle: true,
  watch: false,
  onSuccess: async () => {
    console.log('✅ Build completed successfully');
  }
});
