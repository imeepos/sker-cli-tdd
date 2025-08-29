import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',  // 模块导出
    bin: 'src/bin.ts'       // CLI入口
  },
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
