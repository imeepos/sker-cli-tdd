/**
 * 🔴 TDD 红阶段：Context上下文功能测试
 * 这些测试最初会失败 - 这是正确的 TDD 行为！
 */

import { Context, FileContext, FolderContext, ContextBuilder } from './context'; // ❌ 这会失败 - 正确的！
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('Context上下文功能', () => {
  describe('Context基础接口', () => {
    it('应该定义Context基础接口', () => {
      // ❌ 这会失败，因为Context接口不存在
      const context: Context = {
        path: '/test/file.txt',
        name: 'file.txt',
        type: 'file'
      };
      
      expect(context.path).toBe('/test/file.txt');
      expect(context.name).toBe('file.txt');
      expect(context.type).toBe('file');
    });
  });

  describe('FileContext文件上下文', () => {
    it('应该创建文件上下文', () => {
      // ❌ 这会失败，因为FileContext类不存在
      const fileContext = new FileContext('/test/file.txt');
      
      expect(fileContext.path).toBe('/test/file.txt');
      expect(fileContext.name).toBe('file.txt');
      expect(fileContext.type).toBe('file');
      expect(fileContext.parent).toBeUndefined();
    });

    it('应该正确解析文件名', () => {
      const fileContext = new FileContext('/path/to/document.md');
      
      expect(fileContext.name).toBe('document.md');
      expect(fileContext.extension).toBe('.md');
    });

    it('应该设置父级文件夹上下文', () => {
      const folderContext = new FolderContext('/test');
      const fileContext = new FileContext('/test/file.txt');

      fileContext.setParent(folderContext);

      expect(fileContext.parent).toBe(folderContext);
    });

    it('应该包含文件统计信息', async () => {
      // 创建测试文件
      const testFile = path.join(__dirname, '../test-file-stats.txt');
      const testContent = 'Hello, World!\nThis is a test file.';
      await fs.promises.writeFile(testFile, testContent);

      try {
        // ❌ 这会失败，因为FileContext还没有统计信息功能
        const fileContext = new FileContext(testFile);
        await fileContext.loadFileInfo();

        expect(fileContext.size).toBe(testContent.length);
        expect(fileContext.modifiedTime).toBeDefined();
        expect(typeof fileContext.modifiedTime?.getTime).toBe('function');
        expect(fileContext.createdTime).toBeDefined();
        expect(typeof fileContext.createdTime?.getTime).toBe('function');
        expect(typeof fileContext.hash).toBe('string');
        expect(fileContext.hash).toBeDefined();
        expect(fileContext.hash!.length).toBeGreaterThan(0);
        expect(fileContext.isTextFile).toBe(true);
        expect(fileContext.mimeType).toBeDefined();
      } finally {
        // 清理测试文件
        if (fs.existsSync(testFile)) {
          await fs.promises.unlink(testFile);
        }
      }
    });

    it('应该支持加载文件内容', async () => {
      const testFile = path.join(__dirname, '../test-file-content.txt');
      const testContent = 'This is test content\nwith multiple lines.';
      await fs.promises.writeFile(testFile, testContent);

      try {
        const fileContext = new FileContext(testFile);

        // ❌ 这会失败，因为loadContent方法不存在
        await fileContext.loadContent();

        expect(fileContext.content).toBe(testContent);
        expect(fileContext.hasContent).toBe(true);
      } finally {
        if (fs.existsSync(testFile)) {
          await fs.promises.unlink(testFile);
        }
      }
    });

    it('应该支持生成文件简介', async () => {
      const testFile = path.join(__dirname, '../test-file-summary.js');
      const testContent = `// This is a JavaScript file
function hello() {
  console.log('Hello, World!');
}

module.exports = { hello };`;
      await fs.promises.writeFile(testFile, testContent);

      try {
        const fileContext = new FileContext(testFile);
        await fileContext.loadContent();

        // ❌ 这会失败，因为generateSummary方法不存在
        const summary = fileContext.generateSummary();

        expect(typeof summary).toBe('string');
        expect(summary.length).toBeGreaterThan(0);
        expect(summary).toContain('JavaScript');
      } finally {
        if (fs.existsSync(testFile)) {
          await fs.promises.unlink(testFile);
        }
      }
    });

    it('应该支持检查文件是否为文本文件', async () => {
      const textFile = path.join(__dirname, '../test-text.txt');
      const binaryFile = path.join(__dirname, '../test-binary.bin');

      await fs.promises.writeFile(textFile, 'This is text content');
      await fs.promises.writeFile(binaryFile, Buffer.from([0x00, 0x01, 0x02, 0x03]));

      try {
        const textContext = new FileContext(textFile);
        const binaryContext = new FileContext(binaryFile);

        await textContext.loadFileInfo();
        await binaryContext.loadFileInfo();

        // ❌ 这会失败，因为isTextFile属性不存在
        expect(textContext.isTextFile).toBe(true);
        expect(binaryContext.isTextFile).toBe(false);
      } finally {
        if (fs.existsSync(textFile)) await fs.promises.unlink(textFile);
        if (fs.existsSync(binaryFile)) await fs.promises.unlink(binaryFile);
      }
    });

    it('应该支持获取文件MIME类型', async () => {
      const jsFile = path.join(__dirname, '../test-mime.js');
      const jsonFile = path.join(__dirname, '../test-mime.json');

      await fs.promises.writeFile(jsFile, 'console.log("test");');
      await fs.promises.writeFile(jsonFile, '{"test": true}');

      try {
        const jsContext = new FileContext(jsFile);
        const jsonContext = new FileContext(jsonFile);

        await jsContext.loadFileInfo();
        await jsonContext.loadFileInfo();

        // ❌ 这会失败，因为mimeType属性不存在
        expect(jsContext.mimeType).toContain('javascript');
        expect(jsonContext.mimeType).toContain('json');
      } finally {
        if (fs.existsSync(jsFile)) await fs.promises.unlink(jsFile);
        if (fs.existsSync(jsonFile)) await fs.promises.unlink(jsonFile);
      }
    });
  });

  describe('FolderContext文件夹上下文', () => {
    it('应该创建文件夹上下文', () => {
      // ❌ 这会失败，因为FolderContext类不存在
      const folderContext = new FolderContext('/test/folder');
      
      expect(folderContext.path).toBe('/test/folder');
      expect(folderContext.name).toBe('folder');
      expect(folderContext.type).toBe('folder');
      expect(folderContext.children).toEqual([]);
    });

    it('应该添加子级上下文', () => {
      const folderContext = new FolderContext('/test');
      const fileContext = new FileContext('/test/file.txt');
      
      folderContext.addChild(fileContext);
      
      expect(folderContext.children).toContain(fileContext);
      expect(fileContext.parent).toBe(folderContext);
    });

    it('应该移除子级上下文', () => {
      const folderContext = new FolderContext('/test');
      const fileContext = new FileContext('/test/file.txt');
      
      folderContext.addChild(fileContext);
      folderContext.removeChild(fileContext);
      
      expect(folderContext.children).not.toContain(fileContext);
      expect(fileContext.parent).toBeUndefined();
    });

    it('应该按名称查找子级上下文', () => {
      const folderContext = new FolderContext('/test');
      const fileContext = new FileContext('/test/file.txt');
      
      folderContext.addChild(fileContext);
      
      const found = folderContext.findChild('file.txt');
      expect(found).toBe(fileContext);
      
      const notFound = folderContext.findChild('nonexistent.txt');
      expect(notFound).toBeUndefined();
    });
  });

  describe('ContextBuilder上下文构建器', () => {
    const testDir = path.join(__dirname, '../test-context-dir');
    
    beforeEach(async () => {
      // 创建测试目录结构
      await fs.promises.mkdir(testDir, { recursive: true });
      await fs.promises.mkdir(path.join(testDir, 'subfolder'), { recursive: true });
      await fs.promises.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.promises.writeFile(path.join(testDir, 'file2.md'), 'content2');
      await fs.promises.writeFile(path.join(testDir, 'subfolder', 'nested.js'), 'content3');
    });

    afterEach(async () => {
      // 清理测试目录
      if (fs.existsSync(testDir)) {
        await fs.promises.rm(testDir, { recursive: true, force: true });
      }
    });

    it('应该创建上下文构建器', () => {
      // ❌ 这会失败，因为ContextBuilder类不存在
      const builder = new ContextBuilder();
      
      expect(builder).toBeDefined();
    });

    it('应该扫描目录并构建上下文树', async () => {
      const builder = new ContextBuilder();
      
      // ❌ 这会失败，因为buildFromDirectory方法不存在
      const rootContext = await builder.buildFromDirectory(testDir);
      
      expect(rootContext).toBeInstanceOf(FolderContext);
      expect(rootContext.path).toBe(testDir);
      expect(rootContext.children.length).toBe(3); // file1.txt, file2.md, subfolder
    });

    it('应该正确构建嵌套目录结构', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(testDir);
      
      // 查找子文件夹
      const subfolder = rootContext.findChild('subfolder') as FolderContext;
      expect(subfolder).toBeInstanceOf(FolderContext);
      expect(subfolder.children.length).toBe(1); // nested.js
      
      // 查找嵌套文件
      const nestedFile = subfolder.findChild('nested.js');
      expect(nestedFile).toBeInstanceOf(FileContext);
      expect(nestedFile?.parent).toBe(subfolder);
    });

    it('应该支持文件过滤选项', async () => {
      const builder = new ContextBuilder();
      
      // ❌ 这会失败，因为过滤选项不存在
      const rootContext = await builder.buildFromDirectory(testDir, {
        includeExtensions: ['.txt', '.md'],
        excludeExtensions: ['.js']
      });
      
      expect(rootContext.children.length).toBe(3); // file1.txt, file2.md, subfolder
      
      const subfolder = rootContext.findChild('subfolder') as FolderContext;
      expect(subfolder.children.length).toBe(0); // nested.js被过滤掉
    });

    it('应该支持深度限制选项', async () => {
      const builder = new ContextBuilder();

      const rootContext = await builder.buildFromDirectory(testDir, {
        maxDepth: 1
      });

      expect(rootContext.children.length).toBe(3);

      const subfolder = rootContext.findChild('subfolder') as FolderContext;
      expect(subfolder.children.length).toBe(0); // 深度限制，不扫描子目录内容
    });

    it('应该支持.gitignore文件忽略规则', async () => {
      // 创建.gitignore文件
      const gitignoreContent = `
# 忽略日志文件
*.log
# 忽略临时文件
*.tmp
# 忽略特定目录
ignored-folder/
# 忽略特定文件
ignored-file.txt
`;
      await fs.promises.writeFile(path.join(testDir, '.gitignore'), gitignoreContent);

      // 创建应该被忽略的文件和目录
      await fs.promises.writeFile(path.join(testDir, 'debug.log'), 'log content');
      await fs.promises.writeFile(path.join(testDir, 'temp.tmp'), 'temp content');
      await fs.promises.writeFile(path.join(testDir, 'ignored-file.txt'), 'ignored content');
      await fs.promises.mkdir(path.join(testDir, 'ignored-folder'), { recursive: true });
      await fs.promises.writeFile(path.join(testDir, 'ignored-folder', 'file.txt'), 'content');

      const builder = new ContextBuilder();

      // ❌ 这会失败，因为respectGitignore选项不存在
      const rootContext = await builder.buildFromDirectory(testDir, {
        respectGitignore: true
      });

      // 验证被忽略的文件不在结果中
      expect(rootContext.findChild('debug.log')).toBeUndefined();
      expect(rootContext.findChild('temp.tmp')).toBeUndefined();
      expect(rootContext.findChild('ignored-file.txt')).toBeUndefined();
      expect(rootContext.findChild('ignored-folder')).toBeUndefined();

      // 验证正常文件仍然存在
      expect(rootContext.findChild('file1.txt')).toBeDefined();
      expect(rootContext.findChild('file2.md')).toBeDefined();
      expect(rootContext.findChild('subfolder')).toBeDefined();
    });

    it('应该支持自定义ignore文件路径', async () => {
      // 创建自定义ignore文件
      const customIgnoreContent = `
*.custom
custom-ignored/
`;
      await fs.promises.writeFile(path.join(testDir, '.customignore'), customIgnoreContent);

      // 创建应该被忽略的文件
      await fs.promises.writeFile(path.join(testDir, 'test.custom'), 'custom content');
      await fs.promises.mkdir(path.join(testDir, 'custom-ignored'), { recursive: true });

      const builder = new ContextBuilder();

      // ❌ 这会失败，因为ignoreFile选项不存在
      const rootContext = await builder.buildFromDirectory(testDir, {
        respectGitignore: true,
        ignoreFile: '.customignore'
      });

      // 验证被忽略的文件不在结果中
      expect(rootContext.findChild('test.custom')).toBeUndefined();
      expect(rootContext.findChild('custom-ignored')).toBeUndefined();
    });

    it('应该在没有ignore文件时正常工作', async () => {
      const builder = new ContextBuilder();

      const rootContext = await builder.buildFromDirectory(testDir, {
        respectGitignore: true
      });

      // 应该包含所有文件，因为没有ignore文件
      expect(rootContext.children.length).toBe(3); // file1.txt, file2.md, subfolder
    });

    it('应该支持禁用gitignore功能', async () => {
      // 创建.gitignore文件
      const gitignoreContent = '*.txt';
      await fs.promises.writeFile(path.join(testDir, '.gitignore'), gitignoreContent);

      const builder = new ContextBuilder();

      const rootContext = await builder.buildFromDirectory(testDir, {
        respectGitignore: false // 明确禁用
      });

      // 应该包含所有文件，包括被gitignore的文件
      expect(rootContext.findChild('file1.txt')).toBeDefined();
      expect(rootContext.findChild('file2.md')).toBeDefined();
    });
  });

  describe('Context工具方法', () => {
    it('应该获取上下文的完整路径', () => {
      const folderContext = new FolderContext('/test');
      const fileContext = new FileContext('/test/file.txt');
      folderContext.addChild(fileContext);
      
      expect(fileContext.getFullPath()).toBe('/test/file.txt');
    });

    it('应该获取上下文的相对路径', () => {
      const rootContext = new FolderContext('/project');
      const subfolderContext = new FolderContext('/project/src');
      const fileContext = new FileContext('/project/src/index.ts');
      
      rootContext.addChild(subfolderContext);
      subfolderContext.addChild(fileContext);
      
      expect(fileContext.getRelativePath(rootContext)).toBe(path.join('src', 'index.ts'));
    });

    it('应该检查上下文是否为祖先', () => {
      const rootContext = new FolderContext('/project');
      const subfolderContext = new FolderContext('/project/src');
      const fileContext = new FileContext('/project/src/index.ts');

      rootContext.addChild(subfolderContext);
      subfolderContext.addChild(fileContext);

      expect(fileContext.isDescendantOf(rootContext)).toBe(true);
      expect(fileContext.isDescendantOf(subfolderContext)).toBe(true);
      expect(rootContext.isDescendantOf(fileContext)).toBe(false);
    });

    it('应该获取所有子文件夹的Context', () => {
      const root = new FolderContext('/project');
      const src = new FolderContext('/project/src');
      const tests = new FolderContext('/project/tests');
      const utils = new FolderContext('/project/src/utils');
      const file1 = new FileContext('/project/src/index.ts');
      const file2 = new FileContext('/project/tests/test.ts');

      root.addChild(src);
      root.addChild(tests);
      src.addChild(utils);
      src.addChild(file1);
      tests.addChild(file2);

      // ❌ 这会失败，因为getAllSubfolders方法还没有实现
      const subfolders = root.getAllSubfolders();
      expect(subfolders).toHaveLength(3); // src, tests, utils
      expect(subfolders.map(f => f.name)).toEqual(expect.arrayContaining(['src', 'tests', 'utils']));
    });

    it('应该获取所有子文件的Context', () => {
      const root = new FolderContext('/project');
      const src = new FolderContext('/project/src');
      const tests = new FolderContext('/project/tests');
      const file1 = new FileContext('/project/src/index.ts');
      const file2 = new FileContext('/project/src/utils.ts');
      const file3 = new FileContext('/project/tests/test.ts');
      const file4 = new FileContext('/project/README.md');

      root.addChild(src);
      root.addChild(tests);
      root.addChild(file4);
      src.addChild(file1);
      src.addChild(file2);
      tests.addChild(file3);

      // ❌ 这会失败，因为getAllFiles方法还没有实现
      const allFiles = root.getAllFiles();
      expect(allFiles).toHaveLength(4); // index.ts, utils.ts, test.ts, README.md
      expect(allFiles.map(f => f.name)).toEqual(expect.arrayContaining(['index.ts', 'utils.ts', 'test.ts', 'README.md']));
    });

    it('应该获取所有后代Context（文件和文件夹）', () => {
      const root = new FolderContext('/project');
      const src = new FolderContext('/project/src');
      const utils = new FolderContext('/project/src/utils');
      const file1 = new FileContext('/project/src/index.ts');
      const file2 = new FileContext('/project/src/utils/helper.ts');

      root.addChild(src);
      src.addChild(utils);
      src.addChild(file1);
      utils.addChild(file2);

      // ❌ 这会失败，因为getAllDescendants方法还没有实现
      const descendants = root.getAllDescendants();
      expect(descendants).toHaveLength(4); // src, utils, index.ts, helper.ts

      const folders = descendants.filter(d => d.type === 'folder');
      const files = descendants.filter(d => d.type === 'file');
      expect(folders).toHaveLength(2);
      expect(files).toHaveLength(2);
    });

    it('应该检测项目根目录（包含sker.json）', async () => {
      const testDir = path.join(os.tmpdir(), 'sker-test-project-' + Date.now());
      const skerJsonPath = path.join(testDir, 'sker.json');

      try {
        await fs.promises.mkdir(testDir, { recursive: true });
        await fs.promises.writeFile(skerJsonPath, JSON.stringify({ name: 'test-project' }));

        // 使用ContextBuilder扫描，这样会自动标记isProjectRoot
        const builder = new ContextBuilder();
        const parentDir = path.dirname(testDir);
        const rootContext = await builder.buildFromDirectory(parentDir);
        const folderContext = rootContext.findChild(path.basename(testDir)) as FolderContext;

        expect(folderContext).toBeDefined();
        expect(folderContext.isProjectRoot).toBe(true);

        // 异步方法也应该返回true
        const isProject = await folderContext.checkIsProjectRoot();
        expect(isProject).toBe(true);
      } finally {
        if (fs.existsSync(skerJsonPath)) await fs.promises.unlink(skerJsonPath);
        if (fs.existsSync(testDir)) await fs.promises.rmdir(testDir);
      }
    });

    it('应该检测非项目目录（不包含sker.json）', async () => {
      const testDir = path.join(os.tmpdir(), 'sker-test-non-project-' + Date.now());

      try {
        await fs.promises.mkdir(testDir, { recursive: true });

        const folderContext = new FolderContext(testDir);

        // ❌ 这会失败，因为checkIsProjectRoot方法还没有实现
        const isProject = await folderContext.checkIsProjectRoot();
        expect(isProject).toBe(false);
      } finally {
        if (fs.existsSync(testDir)) await fs.promises.rmdir(testDir);
      }
    });

    it('应该检测多子项目工作空间', async () => {
      const workspaceDir = path.join(os.tmpdir(), 'sker-test-workspace-' + Date.now());
      const project1Dir = path.join(workspaceDir, 'project1');
      const project2Dir = path.join(workspaceDir, 'project2');
      const sker1Path = path.join(project1Dir, 'sker.json');
      const sker2Path = path.join(project2Dir, 'sker.json');

      try {
        await fs.promises.mkdir(project1Dir, { recursive: true });
        await fs.promises.mkdir(project2Dir, { recursive: true });
        await fs.promises.writeFile(sker1Path, JSON.stringify({ name: 'project1' }));
        await fs.promises.writeFile(sker2Path, JSON.stringify({ name: 'project2' }));

        // 使用ContextBuilder扫描，这样会自动标记子项目的isProjectRoot
        const builder = new ContextBuilder();
        const workspaceContext = await builder.buildFromDirectory(workspaceDir);

        // 现在isMultiProjectWorkspace应该基于children的isProjectRoot属性快速判断
        const isWorkspace = await workspaceContext.isMultiProjectWorkspace();
        expect(isWorkspace).toBe(true);

        // getSubProjects方法应该仍然工作
        const subProjects = await workspaceContext.getSubProjects();
        expect(subProjects).toHaveLength(2);
        expect(subProjects.map(p => p.name)).toEqual(expect.arrayContaining(['project1', 'project2']));
      } finally {
        if (fs.existsSync(sker1Path)) await fs.promises.unlink(sker1Path);
        if (fs.existsSync(sker2Path)) await fs.promises.unlink(sker2Path);
        if (fs.existsSync(project1Dir)) await fs.promises.rmdir(project1Dir);
        if (fs.existsSync(project2Dir)) await fs.promises.rmdir(project2Dir);
        if (fs.existsSync(workspaceDir)) await fs.promises.rmdir(workspaceDir);
      }
    });

    it('应该在扫描时自动标记项目根目录', async () => {
      const testDir = path.join(os.tmpdir(), 'sker-test-scan-' + Date.now());
      const projectDir = path.join(testDir, 'my-project');
      const skerJsonPath = path.join(projectDir, 'sker.json');
      const srcDir = path.join(projectDir, 'src');
      const indexFile = path.join(srcDir, 'index.ts');

      try {
        await fs.promises.mkdir(srcDir, { recursive: true });
        await fs.promises.writeFile(skerJsonPath, JSON.stringify({ name: 'my-project' }));
        await fs.promises.writeFile(indexFile, 'console.log("hello");');

        const builder = new ContextBuilder();
        const rootContext = await builder.buildFromDirectory(testDir);

        const projectContext = rootContext.findChild('my-project') as FolderContext;
        expect(projectContext).toBeDefined();

        // ❌ 这会失败，因为isProjectRoot属性还没有实现
        expect(projectContext.isProjectRoot).toBe(true);

        // 同步方法应该直接返回缓存的结果，不需要文件系统访问
        const isProject = await projectContext.checkIsProjectRoot();
        expect(isProject).toBe(true);
      } finally {
        if (fs.existsSync(indexFile)) await fs.promises.unlink(indexFile);
        if (fs.existsSync(skerJsonPath)) await fs.promises.unlink(skerJsonPath);
        if (fs.existsSync(srcDir)) await fs.promises.rmdir(srcDir);
        if (fs.existsSync(projectDir)) await fs.promises.rmdir(projectDir);
        if (fs.existsSync(testDir)) await fs.promises.rmdir(testDir);
      }
    });

    it('应该基于children快速判断多项目工作空间', async () => {
      const workspaceDir = path.join(os.tmpdir(), 'sker-test-fast-workspace-' + Date.now());
      const project1Dir = path.join(workspaceDir, 'project1');
      const project2Dir = path.join(workspaceDir, 'project2');
      const normalDir = path.join(workspaceDir, 'docs');
      const sker1Path = path.join(project1Dir, 'sker.json');
      const sker2Path = path.join(project2Dir, 'sker.json');

      try {
        await fs.promises.mkdir(project1Dir, { recursive: true });
        await fs.promises.mkdir(project2Dir, { recursive: true });
        await fs.promises.mkdir(normalDir, { recursive: true });
        await fs.promises.writeFile(sker1Path, JSON.stringify({ name: 'project1' }));
        await fs.promises.writeFile(sker2Path, JSON.stringify({ name: 'project2' }));

        const builder = new ContextBuilder();
        const workspaceContext = await builder.buildFromDirectory(workspaceDir);

        // ❌ 这会失败，因为优化后的isMultiProjectWorkspace方法还没有实现
        const isWorkspace = await workspaceContext.isMultiProjectWorkspace();
        expect(isWorkspace).toBe(true);

        // 验证子项目被正确标记
        const project1Context = workspaceContext.findChild('project1') as FolderContext;
        const project2Context = workspaceContext.findChild('project2') as FolderContext;
        const docsContext = workspaceContext.findChild('docs') as FolderContext;

        expect(project1Context.isProjectRoot).toBe(true);
        expect(project2Context.isProjectRoot).toBe(true);
        expect(docsContext.isProjectRoot).toBe(false);
      } finally {
        if (fs.existsSync(sker1Path)) await fs.promises.unlink(sker1Path);
        if (fs.existsSync(sker2Path)) await fs.promises.unlink(sker2Path);
        if (fs.existsSync(project1Dir)) await fs.promises.rmdir(project1Dir);
        if (fs.existsSync(project2Dir)) await fs.promises.rmdir(project2Dir);
        if (fs.existsSync(normalDir)) await fs.promises.rmdir(normalDir);
        if (fs.existsSync(workspaceDir)) await fs.promises.rmdir(workspaceDir);
      }
    });
  });
});
