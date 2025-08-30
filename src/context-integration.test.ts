/**
 * 🔄 TDD 重构阶段：Context模块集成测试
 * 验证拆分后的模块能正确协作
 */

import {
  ProjectInfo,
  FileContext,
  FolderContext,
  ContextBuilder,
  ContextBuilderOptions,
} from './context-new';
import * as fs from 'fs';
import * as path from 'path';

describe('Context模块集成测试', () => {
  let testProjectPath: string;

  beforeEach(async () => {
    // 创建完整的测试项目结构
    testProjectPath = path.join(__dirname, '..', 'test-integration-project');

    await fs.promises.mkdir(testProjectPath, { recursive: true });
    await fs.promises.mkdir(path.join(testProjectPath, 'src'), {
      recursive: true,
    });
    await fs.promises.mkdir(path.join(testProjectPath, 'tests'), {
      recursive: true,
    });

    // 创建项目配置文件
    const projectInfo: ProjectInfo = {
      name: 'integration-test-project',
      version: '1.0.0',
      description: 'Integration test project',
    };
    await fs.promises.writeFile(
      path.join(testProjectPath, 'sker.json'),
      JSON.stringify(projectInfo, null, 2),
      'utf8'
    );

    // 创建源文件
    await fs.promises.writeFile(
      path.join(testProjectPath, 'src', 'index.ts'),
      'export const greeting = "Hello World";',
      'utf8'
    );

    // 创建测试文件
    await fs.promises.writeFile(
      path.join(testProjectPath, 'tests', 'index.test.ts'),
      'import { greeting } from "../src/index";\ntest("greeting", () => expect(greeting).toBe("Hello World"));',
      'utf8'
    );

    // 创建其他文件
    await fs.promises.writeFile(
      path.join(testProjectPath, 'package.json'),
      '{"name": "test", "version": "1.0.0"}',
      'utf8'
    );
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  describe('完整工作流程', () => {
    it('应该能构建完整的项目上下文树', async () => {
      const builder = new ContextBuilder();
      const options: ContextBuilderOptions = {
        includeExtensions: ['.ts', '.js', '.json'],
      };

      const rootContext = await builder.buildFromDirectory(
        testProjectPath,
        options
      );

      // 验证根目录
      expect(rootContext).toBeInstanceOf(FolderContext);
      expect(rootContext.isProjectRoot).toBe(true);
      expect(rootContext.projectInfo?.name).toBe('integration-test-project');

      // 验证src目录
      const srcContext = rootContext.findChild('src') as FolderContext;
      expect(srcContext).toBeInstanceOf(FolderContext);
      expect(srcContext.parent).toBe(rootContext);

      // 验证源文件
      const indexFile = srcContext?.findChild('index.ts') as FileContext;
      expect(indexFile).toBeInstanceOf(FileContext);
      expect(indexFile.parent).toBe(srcContext);
      expect(indexFile.extension).toBe('.ts');

      // 验证测试目录
      const testsContext = rootContext.findChild('tests') as FolderContext;
      expect(testsContext).toBeInstanceOf(FolderContext);

      // 验证测试文件
      const testFile = testsContext?.findChild('index.test.ts') as FileContext;
      expect(testFile).toBeInstanceOf(FileContext);

      // 验证package.json
      const packageFile = rootContext.findChild('package.json') as FileContext;
      expect(packageFile).toBeInstanceOf(FileContext);
      expect(packageFile.mimeType).toBe('application/json');
    });

    it('应该正确处理文件内容加载', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(testProjectPath);

      const srcContext = rootContext.findChild('src') as FolderContext;
      const indexFile = srcContext?.findChild('index.ts') as FileContext;

      await indexFile.loadContent();

      expect(indexFile.content).toContain('Hello World');
      expect(indexFile.hash).toBeDefined();
      expect(indexFile.hash?.length).toBe(64); // SHA256长度
    });

    it('应该正确处理文件信息加载', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(testProjectPath);

      const packageFile = rootContext.findChild('package.json') as FileContext;
      await packageFile.loadFileInfo();

      expect(packageFile.size).toBeGreaterThan(0);
      expect(packageFile.lastModified).toBeDefined();
    });

    it('应该支持深度限制', async () => {
      const builder = new ContextBuilder();
      const options: ContextBuilderOptions = {
        maxDepth: 1,
      };

      const rootContext = await builder.buildFromDirectory(
        testProjectPath,
        options
      );

      // 应该有src和tests文件夹
      const srcContext = rootContext.findChild('src') as FolderContext;
      expect(srcContext).toBeDefined();

      // 但src文件夹内部不应该有文件（深度限制）
      expect(srcContext.children.length).toBe(0);
    });

    it('应该支持文件类型过滤', async () => {
      const builder = new ContextBuilder();
      const options: ContextBuilderOptions = {
        includeExtensions: ['.ts'],
      };

      const rootContext = await builder.buildFromDirectory(
        testProjectPath,
        options
      );

      // 应该包含TypeScript文件
      const allFiles = getAllFiles(rootContext);
      const tsFiles = allFiles.filter(
        (file: FileContext) => file.extension === '.ts'
      );
      const jsonFiles = allFiles.filter(
        (file: FileContext) => file.extension === '.json'
      );

      expect(tsFiles.length).toBeGreaterThan(0);
      expect(jsonFiles.length).toBe(0); // 应该被过滤掉
    });

    it('应该计算文件夹总大小', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(testProjectPath);

      const totalSize = await rootContext.getTotalSize();

      expect(totalSize).toBeGreaterThan(0);
    });
  });
});

/**
 * 递归获取所有文件上下文的辅助函数
 */
function getAllFiles(context: FolderContext): FileContext[] {
  const files: FileContext[] = [];

  for (const child of context.children) {
    if (child.type === 'file') {
      files.push(child as FileContext);
    } else if (child.type === 'folder') {
      files.push(...getAllFiles(child as FolderContext));
    }
  }

  return files;
}
