/**
 * 🔴 TDD 红阶段：ContextBuilder 增量更新测试文件
 * 测试 ContextBuilder 的增量更新功能
 */

import { ContextBuilder } from './context-builder';
import { FileChangeEvent } from './watchers/project-watcher';
import { FolderContext } from './folder-context';
import { Context } from './context-base';
import * as path from 'path';
import * as fs from 'fs';

describe('ContextBuilder 增量更新功能', () => {
  let tempDir: string;
  let builder: ContextBuilder;

  beforeAll(async () => {
    // 创建临时测试目录
    tempDir = path.join(__dirname, '../test-tmp-context');
    await fs.promises.mkdir(tempDir, { recursive: true });

    // 创建测试文件结构
    await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.promises.writeFile(path.join(tempDir, 'src', 'app.ts'), 'export const app = "main";');
    await fs.promises.writeFile(path.join(tempDir, 'src', 'utils.ts'), 'export const utils = "helper";');
    await fs.promises.writeFile(path.join(tempDir, 'package.json'), '{"name": "test-project"}');
  });

  afterAll(async () => {
    // 清理临时目录
    try {
      await fs.promises.rm(tempDir, { recursive: true });
    } catch {
      // 忽略删除错误
    }
  });

  beforeEach(() => {
    builder = new ContextBuilder();
  });

  describe('增量更新接口', () => {
    it('应该提供文件变更处理方法', () => {
      // 检查是否有处理文件变更的方法
      expect(typeof builder.handleFileChange).toBe('function');
    });

    it('应该提供获取文件依赖的方法', () => {
      // 检查是否有获取文件依赖关系的方法
      expect(typeof builder.getFileDependencies).toBe('function');
    });

    it('应该提供更新单个文件上下文的方法', () => {
      // 检查是否有更新单个文件上下文的方法
      expect(typeof builder.updateFileContext).toBe('function');
    });

    it('应该提供获取受影响文件列表的方法', () => {
      // 检查是否有获取受影响文件的方法
      expect(typeof builder.getAffectedFiles).toBe('function');
    });
  });

  describe('文件变更处理', () => {
    it('应该能够处理新文件添加事件', async () => {
      // 首先构建初始上下文
      const rootContext = await builder.buildFromDirectory(tempDir);
      expect(rootContext).toBeDefined();

      // 创建新文件
      const newFilePath = path.join(tempDir, 'src', 'new-file.ts');
      await fs.promises.writeFile(newFilePath, 'export const newFile = "test";');

      // 创建文件变更事件
      const changeEvent: FileChangeEvent = {
        type: 'add',
        path: newFilePath,
        timestamp: Date.now(),
        projectId: 'test-project'
      };

      // 处理变更事件
      const result = await builder.handleFileChange(changeEvent);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.affectedFiles).toContain(newFilePath);

      // 验证新文件已添加到上下文中
      const updatedContext = await builder.buildFromDirectory(tempDir);
      const srcFolder = updatedContext.children.find(child => child.name === 'src' && child.type === 'folder') as FolderContext;
      expect(srcFolder).toBeDefined();
      
      const newFileContext = srcFolder!.children.find((child: Context) => child.name === 'new-file.ts');
      expect(newFileContext).toBeDefined();

      // 清理测试文件
      await fs.promises.unlink(newFilePath);
    });

    it('应该能够处理文件修改事件', async () => {
      // 首先构建初始上下文
      const rootContext = await builder.buildFromDirectory(tempDir);
      expect(rootContext).toBeDefined();

      // 修改现有文件
      const existingFilePath = path.join(tempDir, 'src', 'app.ts');
      const originalContent = await fs.promises.readFile(existingFilePath, 'utf8');
      await fs.promises.writeFile(existingFilePath, 'export const app = "modified";');

      // 创建文件变更事件
      const changeEvent: FileChangeEvent = {
        type: 'change',
        path: existingFilePath,
        timestamp: Date.now(),
        projectId: 'test-project'
      };

      // 处理变更事件
      const result = await builder.handleFileChange(changeEvent);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.affectedFiles).toContain(existingFilePath);

      // 恢复原始文件内容
      await fs.promises.writeFile(existingFilePath, originalContent);
    });

    it('应该能够处理文件删除事件', async () => {
      // 创建临时文件
      const tempFilePath = path.join(tempDir, 'src', 'temp-file.ts');
      await fs.promises.writeFile(tempFilePath, 'export const temp = "delete me";');

      // 构建包含临时文件的上下文
      const rootContext = await builder.buildFromDirectory(tempDir);
      expect(rootContext).toBeDefined();

      // 删除文件
      await fs.promises.unlink(tempFilePath);

      // 创建文件变更事件
      const changeEvent: FileChangeEvent = {
        type: 'unlink',
        path: tempFilePath,
        timestamp: Date.now(),
        projectId: 'test-project'
      };

      // 处理变更事件
      const result = await builder.handleFileChange(changeEvent);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.affectedFiles).toContain(tempFilePath);
    });
  });

  describe('依赖分析', () => {
    it('应该能够分析TypeScript文件的导入依赖', async () => {
      // 创建有依赖关系的文件
      const moduleAPath = path.join(tempDir, 'src', 'module-a.ts');
      const moduleBPath = path.join(tempDir, 'src', 'module-b.ts');
      
      await fs.promises.writeFile(moduleAPath, 'export const a = "module a";');
      await fs.promises.writeFile(moduleBPath, 'import { a } from "./module-a";\nexport const b = a + " and b";');

      // 构建上下文以建立依赖关系
      await builder.buildFromDirectory(tempDir);

      // 获取文件依赖
      const dependencies = await builder.getFileDependencies(moduleBPath);
      
      expect(dependencies).toBeDefined();
      expect(dependencies.imports).toContain(moduleAPath);

      // 清理测试文件
      await fs.promises.unlink(moduleAPath);
      await fs.promises.unlink(moduleBPath);
    });

    it('应该能够分析影响传播', async () => {
      // 创建依赖链：C -> B -> A
      const moduleAPath = path.join(tempDir, 'src', 'chain-a.ts');
      const moduleBPath = path.join(tempDir, 'src', 'chain-b.ts');
      const moduleCPath = path.join(tempDir, 'src', 'chain-c.ts');
      
      await fs.promises.writeFile(moduleAPath, 'export const a = "chain a";');
      await fs.promises.writeFile(moduleBPath, 'import { a } from "./chain-a";\nexport const b = a + " -> b";');
      await fs.promises.writeFile(moduleCPath, 'import { b } from "./chain-b";\nexport const c = b + " -> c";');

      // 构建上下文以建立依赖关系
      await builder.buildFromDirectory(tempDir);

      // 分析修改 A 文件的影响
      const affectedFiles = await builder.getAffectedFiles(moduleAPath);
      
      expect(affectedFiles).toBeDefined();
      expect(affectedFiles).toContain(moduleBPath);
      expect(affectedFiles).toContain(moduleCPath);

      // 清理测试文件
      await fs.promises.unlink(moduleAPath);
      await fs.promises.unlink(moduleBPath);
      await fs.promises.unlink(moduleCPath);
    });
  });

  describe('性能优化', () => {
    it.skip('应该只更新受影响的文件而不是重建整个上下文', async () => {
      // 构建初始上下文
      const startTime = Date.now();
      await builder.buildFromDirectory(tempDir);
      const fullBuildTime = Date.now() - startTime;

      // 修改单个文件
      const targetFile = path.join(tempDir, 'src', 'app.ts');
      const changeEvent: FileChangeEvent = {
        type: 'change',
        path: targetFile,
        timestamp: Date.now(),
        projectId: 'test-project'
      };

      // 增量更新
      const incrementalStartTime = Date.now();
      const result = await builder.handleFileChange(changeEvent);
      const incrementalTime = Date.now() - incrementalStartTime;

      expect(result.success).toBe(true);
      
      // 增量更新应该比全量构建快
      expect(incrementalTime).toBeLessThan(fullBuildTime);
    });

    it.skip('应该维护内部缓存以提高后续更新性能', async () => {
      // 构建初始上下文
      await builder.buildFromDirectory(tempDir);

      const targetFile = path.join(tempDir, 'src', 'utils.ts');
      const changeEvent: FileChangeEvent = {
        type: 'change',
        path: targetFile,
        timestamp: Date.now(),
        projectId: 'test-project'
      };

      // 第一次增量更新
      const firstUpdateStart = Date.now();
      const firstResult = await builder.handleFileChange(changeEvent);
      const firstUpdateTime = Date.now() - firstUpdateStart;

      // 第二次相同的更新（应该更快，因为有缓存）
      const secondUpdateStart = Date.now();
      const secondResult = await builder.handleFileChange(changeEvent);
      const secondUpdateTime = Date.now() - secondUpdateStart;

      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(true);
      
      // 第二次更新应该更快（有缓存优化）
      expect(secondUpdateTime).toBeLessThanOrEqual(firstUpdateTime);
    });
  });

  describe('错误处理', () => {
    it('应该优雅处理不存在文件的变更事件', async () => {
      const nonExistentFile = path.join(tempDir, 'non-existent.ts');
      const changeEvent: FileChangeEvent = {
        type: 'change',
        path: nonExistentFile,
        timestamp: Date.now(),
        projectId: 'test-project'
      };

      const result = await builder.handleFileChange(changeEvent);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该处理格式错误的文件内容', async () => {
      // 创建包含语法错误的文件
      const malformedFile = path.join(tempDir, 'src', 'malformed.ts');
      await fs.promises.writeFile(malformedFile, 'export const incomplete = ');

      const changeEvent: FileChangeEvent = {
        type: 'add',
        path: malformedFile,
        timestamp: Date.now(),
        projectId: 'test-project'
      };

      // 应该能处理而不崩溃
      const result = await builder.handleFileChange(changeEvent);
      
      expect(result).toBeDefined();
      // 可能成功也可能失败，但不应该抛出异常

      // 清理测试文件
      await fs.promises.unlink(malformedFile);
    });
  });
});