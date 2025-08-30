/**
 * 🔴 TDD 红阶段：文件过滤引擎测试文件
 * 文件过滤引擎的单元测试
 */

import { FileFilterEngine } from './file-filter-engine';
import * as path from 'path';
import * as fs from 'fs';

describe('FileFilterEngine 文件过滤引擎', () => {
  let tempDir: string;
  let filterEngine: FileFilterEngine;

  beforeAll(async () => {
    // 创建临时测试目录
    tempDir = path.join(__dirname, '../../test-tmp-filter');
    await fs.promises.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    // 清理临时目录
    try {
      await fs.promises.rm(tempDir, { recursive: true });
    } catch {
      // 忽略删除错误
    }
  });

  describe('基础功能', () => {
    it('应该能够创建FileFilterEngine实例', () => {
      filterEngine = new FileFilterEngine();
      expect(filterEngine).toBeInstanceOf(FileFilterEngine);
    });

    it('应该能够设置忽略模式', () => {
      filterEngine = new FileFilterEngine();
      const patterns = ['**/node_modules/**', '**/*.log', '**/dist/**'];
      filterEngine.setIgnorePatterns(patterns);
      
      expect(filterEngine.getIgnorePatterns()).toEqual(patterns);
    });

    it('应该能够设置包含扩展名', () => {
      filterEngine = new FileFilterEngine();
      const extensions = ['.ts', '.js', '.json'];
      filterEngine.setIncludeExtensions(extensions);
      
      expect(filterEngine.getIncludeExtensions()).toEqual(extensions);
    });

    it('应该能够设置排除扩展名', () => {
      filterEngine = new FileFilterEngine();
      const extensions = ['.log', '.tmp', '.cache'];
      filterEngine.setExcludeExtensions(extensions);
      
      expect(filterEngine.getExcludeExtensions()).toEqual(extensions);
    });
  });

  describe('扩展名过滤', () => {
    it('应该根据包含扩展名过滤文件', () => {
      filterEngine = new FileFilterEngine();
      filterEngine.setIncludeExtensions(['.ts', '.js']);

      expect(filterEngine.shouldIncludeFile('test.ts')).toBe(true);
      expect(filterEngine.shouldIncludeFile('test.js')).toBe(true);
      expect(filterEngine.shouldIncludeFile('test.json')).toBe(false);
      expect(filterEngine.shouldIncludeFile('test.log')).toBe(false);
    });

    it('应该根据排除扩展名过滤文件', () => {
      filterEngine = new FileFilterEngine();
      filterEngine.setExcludeExtensions(['.log', '.tmp']);

      expect(filterEngine.shouldIncludeFile('test.ts')).toBe(true);
      expect(filterEngine.shouldIncludeFile('test.js')).toBe(true);
      expect(filterEngine.shouldIncludeFile('test.log')).toBe(false);
      expect(filterEngine.shouldIncludeFile('test.tmp')).toBe(false);
    });

    it('包含扩展名优先级应该高于排除扩展名', () => {
      filterEngine = new FileFilterEngine();
      filterEngine.setIncludeExtensions(['.ts', '.js']);
      filterEngine.setExcludeExtensions(['.js', '.json']); // .js同时在包含和排除中

      expect(filterEngine.shouldIncludeFile('test.ts')).toBe(true);
      expect(filterEngine.shouldIncludeFile('test.js')).toBe(true); // 包含优先
      expect(filterEngine.shouldIncludeFile('test.json')).toBe(false);
    });

    it('没有设置过滤规则时应该包含所有文件', () => {
      filterEngine = new FileFilterEngine();

      expect(filterEngine.shouldIncludeFile('test.ts')).toBe(true);
      expect(filterEngine.shouldIncludeFile('test.js')).toBe(true);
      expect(filterEngine.shouldIncludeFile('test.log')).toBe(true);
      expect(filterEngine.shouldIncludeFile('test.anything')).toBe(true);
    });
  });

  describe('gitignore 规则解析', () => {
    it('应该能够从gitignore内容设置忽略规则', () => {
      filterEngine = new FileFilterEngine();
      
      const gitignoreContent = `
# 依赖目录
node_modules/
dist/

# 日志文件
*.log

# 临时文件
*.tmp
.DS_Store

# 特定文件
config.local.json
      `.trim();

      filterEngine.setGitignoreContent(gitignoreContent);
      
      const patterns = filterEngine.getIgnorePatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('应该能够从文件路径加载gitignore规则', async () => {
      const gitignoreFile = path.join(tempDir, '.gitignore');
      const gitignoreContent = `
node_modules/
*.log
dist/
      `.trim();

      await fs.promises.writeFile(gitignoreFile, gitignoreContent);

      filterEngine = new FileFilterEngine();
      await filterEngine.loadGitignoreFromFile(gitignoreFile);
      
      const patterns = filterEngine.getIgnorePatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('当gitignore文件不存在时应该优雅处理', async () => {
      const nonExistentFile = path.join(tempDir, 'non-existent.gitignore');
      
      filterEngine = new FileFilterEngine();
      
      // 不应该抛出异常
      await expect(filterEngine.loadGitignoreFromFile(nonExistentFile)).resolves.toBeUndefined();
      
      // 应该没有设置任何忽略规则
      expect(filterEngine.getIgnorePatterns()).toEqual([]);
    });
  });

  describe('综合过滤测试', () => {
    it('应该同时应用扩展名过滤和gitignore规则', () => {
      filterEngine = new FileFilterEngine();
      filterEngine.setIncludeExtensions(['.ts', '.js', '.json']);
      filterEngine.setGitignoreContent('node_modules/\n*.log\ndist/');

      // TypeScript文件，不在忽略列表中 - 应该包含
      expect(filterEngine.shouldIncludeFile('src/app.ts')).toBe(true);
      
      // 日志文件，在忽略列表中 - 应该排除
      expect(filterEngine.shouldIncludeFile('app.log')).toBe(false);
      
      // node_modules中的文件 - 应该排除
      expect(filterEngine.shouldIncludeFile('node_modules/package/index.js')).toBe(false);
      
      // 不在包含扩展名中的文件 - 应该排除
      expect(filterEngine.shouldIncludeFile('readme.md')).toBe(false);
    });

    it('应该能够检查目录是否应该被忽略', () => {
      filterEngine = new FileFilterEngine();
      filterEngine.setGitignoreContent('node_modules/\ndist/\n*.log');

      expect(filterEngine.shouldIgnoreDirectory('node_modules')).toBe(true);
      expect(filterEngine.shouldIgnoreDirectory('dist')).toBe(true);
      expect(filterEngine.shouldIgnoreDirectory('src')).toBe(false);
      expect(filterEngine.shouldIgnoreDirectory('lib')).toBe(false);
    });

    it('应该能够处理相对路径和绝对路径', () => {
      filterEngine = new FileFilterEngine();
      filterEngine.setGitignoreContent('node_modules/\n*.log');

      // 相对路径
      expect(filterEngine.shouldIncludeFile('src/app.ts')).toBe(true);
      expect(filterEngine.shouldIncludeFile('node_modules/lib/index.js')).toBe(false);
      
      // 绝对路径（基于当前工作目录）
      const absoluteGoodPath = path.resolve('src/app.ts');
      const absoluteBadPath = path.resolve('node_modules/lib/index.js');
      
      expect(filterEngine.shouldIncludeFile(absoluteGoodPath)).toBe(true);
      expect(filterEngine.shouldIncludeFile(absoluteBadPath)).toBe(false);
    });
  });

  describe('性能测试', () => {
    it('应该能够快速处理大量文件路径', () => {
      filterEngine = new FileFilterEngine();
      filterEngine.setIncludeExtensions(['.ts', '.js']);
      filterEngine.setGitignoreContent('node_modules/\\n*.log\\ndist/');

      const testFiles = [
        'src/app.ts',
        'src/utils.js',
        'src/config.json',
        'node_modules/lib/index.js',
        'dist/bundle.js',
        'app.log',
        'test.tmp'
      ];

      const startTime = Date.now();
      
      // 重复处理1000次来测试性能
      for (let i = 0; i < 1000; i++) {
        testFiles.forEach(file => {
          filterEngine.shouldIncludeFile(file);
        });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 1000次 × 7个文件 = 7000次调用应该在合理时间内完成（比如500ms）
      expect(duration).toBeLessThan(500);
    });
  });
});