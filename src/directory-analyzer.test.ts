import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DirectoryAnalyzer } from './directory-analyzer';
import { ContextBuilder } from './context';

describe('目录结构分析工具', () => {
  let tempDir: string;
  let analyzer: DirectoryAnalyzer;

  beforeEach(async () => {
    // 创建临时测试环境
    tempDir = path.join(os.tmpdir(), 'sker-dir-analyzer-test-' + Date.now());
    await fs.promises.mkdir(tempDir, { recursive: true });

    // 创建复杂的目录结构用于测试
    const srcDir = path.join(tempDir, 'src');
    const testDir = path.join(tempDir, 'tests');
    const docsDir = path.join(tempDir, 'docs');
    const nodeModulesDir = path.join(tempDir, 'node_modules');
    const distDir = path.join(tempDir, 'dist');

    await fs.promises.mkdir(srcDir, { recursive: true });
    await fs.promises.mkdir(testDir, { recursive: true });
    await fs.promises.mkdir(docsDir, { recursive: true });
    await fs.promises.mkdir(nodeModulesDir, { recursive: true });
    await fs.promises.mkdir(distDir, { recursive: true });

    // 创建文件
    await fs.promises.writeFile(
      path.join(tempDir, 'package.json'),
      '{"name": "test"}'
    );
    await fs.promises.writeFile(
      path.join(tempDir, 'README.md'),
      '# Test Project'
    );
    await fs.promises.writeFile(
      path.join(srcDir, 'index.ts'),
      'export * from "./lib";'
    );
    await fs.promises.writeFile(
      path.join(srcDir, 'lib.ts'),
      'export const lib = true;'
    );
    await fs.promises.writeFile(
      path.join(testDir, 'index.test.ts'),
      'test("should work", () => {});'
    );
    await fs.promises.writeFile(
      path.join(docsDir, 'api.md'),
      '# API Documentation'
    );
    await fs.promises.writeFile(
      path.join(nodeModulesDir, 'package.json'),
      '{}'
    );
    await fs.promises.writeFile(
      path.join(distDir, 'index.js'),
      'console.log("built");'
    );

    analyzer = new DirectoryAnalyzer();
  });

  afterEach(async () => {
    // 清理测试环境
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('目录结构分析功能', () => {
    it('应该分析目录的基本结构信息', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(tempDir);

      // ❌ 这会失败，因为DirectoryAnalyzer还没有实现
      const analysis = await analyzer.analyzeStructure(rootContext);

      expect(analysis).toHaveProperty('totalFiles');
      expect(analysis).toHaveProperty('totalFolders');
      expect(analysis).toHaveProperty('totalSize');
      expect(analysis).toHaveProperty('maxDepth');
      expect(analysis).toHaveProperty('fileTypes');
      expect(analysis.totalFiles).toBeGreaterThan(0);
      expect(analysis.totalFolders).toBeGreaterThan(0);
    });

    it('应该分析文件类型分布', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(tempDir);

      // ❌ 这会失败，因为analyzeFileTypes方法还没有实现
      const fileTypes = await analyzer.analyzeFileTypes(rootContext);

      expect(fileTypes).toBeDefined();
      expect(typeof fileTypes).toBe('object');
      expect(fileTypes['.ts']).toBeGreaterThan(0);
      expect(fileTypes['.md']).toBeGreaterThan(0);
      expect(fileTypes['.json']).toBeGreaterThan(0);
    });

    it('应该分析目录深度信息', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(tempDir);

      // ❌ 这会失败，因为analyzeDepth方法还没有实现
      const depthInfo = await analyzer.analyzeDepth(rootContext);

      expect(depthInfo).toHaveProperty('maxDepth');
      expect(depthInfo).toHaveProperty('avgDepth');
      expect(depthInfo).toHaveProperty('depthDistribution');
      expect(depthInfo.maxDepth).toBeGreaterThanOrEqual(1);
      expect(depthInfo.avgDepth).toBeGreaterThanOrEqual(0);
    });

    it('应该识别项目类型', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(tempDir);

      // ❌ 这会失败，因为detectProjectType方法还没有实现
      const projectType = await analyzer.detectProjectType(rootContext);

      expect(projectType).toHaveProperty('type');
      expect(projectType).toHaveProperty('confidence');
      expect(projectType).toHaveProperty('indicators');
      expect(projectType.type).toBe('nodejs');
      expect(projectType.confidence).toBeGreaterThan(0.5);
    });

    it('应该分析目录大小分布', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(tempDir);

      // ❌ 这会失败，因为analyzeSizeDistribution方法还没有实现
      const sizeDistribution =
        await analyzer.analyzeSizeDistribution(rootContext);

      expect(sizeDistribution).toHaveProperty('totalSize');
      expect(sizeDistribution).toHaveProperty('largestFiles');
      expect(sizeDistribution).toHaveProperty('largestFolders');
      expect(sizeDistribution).toHaveProperty('sizeByType');
      expect(Array.isArray(sizeDistribution.largestFiles)).toBe(true);
      expect(Array.isArray(sizeDistribution.largestFolders)).toBe(true);
    });
  });

  describe('目录结构可视化功能', () => {
    it('应该生成树形结构文本', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(tempDir);

      // ❌ 这会失败，因为generateTreeView方法还没有实现
      const treeView = await analyzer.generateTreeView(rootContext);

      expect(typeof treeView).toBe('string');
      expect(treeView).toContain('src');
      expect(treeView).toContain('tests');
      expect(treeView).toContain('docs');
      expect(treeView).toContain('├──');
      expect(treeView).toContain('└──');
    });

    it('应该生成带过滤的树形结构', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(tempDir);

      // ❌ 这会失败，因为generateTreeView方法还没有实现
      const treeView = await analyzer.generateTreeView(rootContext, {
        includeFiles: false,
        maxDepth: 2,
        excludePatterns: ['node_modules', 'dist'],
      });

      expect(typeof treeView).toBe('string');
      expect(treeView).toContain('src');
      expect(treeView).toContain('tests');
      expect(treeView).not.toContain('node_modules');
      expect(treeView).not.toContain('dist');
      expect(treeView).not.toContain('.ts'); // 不包含文件
    });

    it('应该生成JSON格式的结构数据', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(tempDir);

      // ❌ 这会失败，因为generateStructureData方法还没有实现
      const structureData = await analyzer.generateStructureData(rootContext);

      expect(structureData).toHaveProperty('name');
      expect(structureData).toHaveProperty('type');
      expect(structureData).toHaveProperty('children');
      expect(structureData.type).toBe('folder');
      expect(Array.isArray(structureData.children)).toBe(true);
      expect(structureData.children?.length).toBeGreaterThan(0);
    });

    it('应该生成Mermaid图表代码', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(tempDir);

      // ❌ 这会失败，因为generateMermaidDiagram方法还没有实现
      const mermaidCode = await analyzer.generateMermaidDiagram(rootContext);

      expect(typeof mermaidCode).toBe('string');
      expect(mermaidCode).toContain('graph TD');
      expect(mermaidCode).toContain('src');
      expect(mermaidCode).toContain('tests');
      expect(mermaidCode).toContain('-->');
    });

    it('应该生成HTML格式的交互式目录树', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(tempDir);

      // ❌ 这会失败，因为generateInteractiveTree方法还没有实现
      const htmlTree = await analyzer.generateInteractiveTree(rootContext);

      expect(typeof htmlTree).toBe('string');
      expect(htmlTree).toContain('<html');
      expect(htmlTree).toContain('<script');
      expect(htmlTree).toContain('src');
      expect(htmlTree).toContain('tests');
    });
  });

  describe('目录结构比较功能', () => {
    it('应该比较两个目录结构的差异', async () => {
      // 创建第二个测试目录
      const tempDir2 = path.join(
        os.tmpdir(),
        'sker-dir-analyzer-test2-' + Date.now()
      );
      await fs.promises.mkdir(tempDir2, { recursive: true });

      try {
        // 创建稍微不同的结构
        const srcDir2 = path.join(tempDir2, 'src');
        await fs.promises.mkdir(srcDir2, { recursive: true });
        await fs.promises.writeFile(
          path.join(tempDir2, 'package.json'),
          '{"name": "test2"}'
        );
        await fs.promises.writeFile(
          path.join(srcDir2, 'index.ts'),
          'export * from "./lib";'
        );
        await fs.promises.writeFile(
          path.join(srcDir2, 'utils.ts'),
          'export const utils = true;'
        ); // 新文件

        const builder = new ContextBuilder();
        const rootContext1 = await builder.buildFromDirectory(tempDir);
        const rootContext2 = await builder.buildFromDirectory(tempDir2);

        // ❌ 这会失败，因为compareStructures方法还没有实现
        const comparison = await analyzer.compareStructures(
          rootContext1,
          rootContext2
        );

        expect(comparison).toHaveProperty('added');
        expect(comparison).toHaveProperty('removed');
        expect(comparison).toHaveProperty('modified');
        expect(comparison).toHaveProperty('unchanged');
        expect(Array.isArray(comparison.added)).toBe(true);
        expect(Array.isArray(comparison.removed)).toBe(true);
      } finally {
        await fs.promises.rm(tempDir2, { recursive: true, force: true });
      }
    });

    it('应该生成结构变化报告', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(tempDir);

      // 模拟结构变化
      const newFile = path.join(tempDir, 'src', 'new-file.ts');
      await fs.promises.writeFile(newFile, 'export const newFeature = true;');

      const updatedContext = await builder.buildFromDirectory(tempDir);

      // ❌ 这会失败，因为generateChangeReport方法还没有实现
      const changeReport = await analyzer.generateChangeReport(
        rootContext,
        updatedContext
      );

      expect(typeof changeReport).toBe('string');
      expect(changeReport).toContain('结构变化报告');
      expect(changeReport).toContain('新增文件');
      expect(changeReport).toContain('new-file.ts');
    });
  });

  describe('目录结构优化建议', () => {
    it('应该分析并提供结构优化建议', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(tempDir);

      // ❌ 这会失败，因为analyzeOptimizations方法还没有实现
      const suggestions = await analyzer.analyzeOptimizations(rootContext);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty('type');
      expect(suggestions[0]).toHaveProperty('description');
      expect(suggestions[0]).toHaveProperty('priority');
      expect(suggestions[0]).toHaveProperty('impact');
    });

    it('应该检测常见的结构问题', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(tempDir);

      // ❌ 这会失败，因为detectStructureIssues方法还没有实现
      const issues = await analyzer.detectStructureIssues(rootContext);

      expect(Array.isArray(issues)).toBe(true);
      if (issues.length > 0) {
        expect(issues[0]).toHaveProperty('issue');
        expect(issues[0]).toHaveProperty('severity');
        expect(issues[0]).toHaveProperty('location');
        expect(issues[0]).toHaveProperty('suggestion');
      }
    });

    it('应该生成结构健康度评分', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(tempDir);

      // ❌ 这会失败，因为calculateHealthScore方法还没有实现
      const healthScore = await analyzer.calculateHealthScore(rootContext);

      expect(healthScore).toHaveProperty('overall');
      expect(healthScore).toHaveProperty('organization');
      expect(healthScore).toHaveProperty('maintainability');
      expect(healthScore).toHaveProperty('scalability');
      expect(healthScore).toHaveProperty('details');
      expect(healthScore.overall).toBeGreaterThanOrEqual(0);
      expect(healthScore.overall).toBeLessThanOrEqual(100);
    });
  });

  describe('导出和报告功能', () => {
    it('应该导出完整的分析报告', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(tempDir);

      // ❌ 这会失败，因为exportAnalysisReport方法还没有实现
      const report = await analyzer.exportAnalysisReport(rootContext, {
        format: 'markdown',
        includeTreeView: true,
        includeStatistics: true,
        includeOptimizations: true,
      });

      expect(typeof report).toBe('string');
      expect(report).toContain('# 目录结构分析报告');
      expect(report).toContain('## 基本统计');
      expect(report).toContain('## 目录树');
      expect(report).toContain('## 优化建议');
    });

    it('应该导出JSON格式的分析数据', async () => {
      const builder = new ContextBuilder();
      const rootContext = await builder.buildFromDirectory(tempDir);

      // ❌ 这会失败，因为exportAnalysisData方法还没有实现
      const data = await analyzer.exportAnalysisData(rootContext);

      expect(data).toHaveProperty('structure');
      expect(data).toHaveProperty('statistics');
      expect(data).toHaveProperty('fileTypes');
      expect(data).toHaveProperty('projectType');
      expect(data).toHaveProperty('healthScore');
      expect(data).toHaveProperty('suggestions');
    });
  });
});
