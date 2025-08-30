/**
 * 🔴 TDD 红阶段：全局提示词模板加载器测试
 * 测试从用户目录 ~/.sker/prompts 加载提示词模板的功能
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PromptTemplatesProvider } from './prompt-templates';
import { MCPPromptManager } from './mcp-prompts';

describe('全局提示词模板加载器', () => {
  let promptManager: MCPPromptManager;
  let provider: PromptTemplatesProvider;
  let testPromptsDir: string;

  beforeEach(() => {
    promptManager = new MCPPromptManager();
    provider = new PromptTemplatesProvider(promptManager);

    // 使用临时目录进行测试
    testPromptsDir = path.join(
      os.tmpdir(),
      'sker-test-prompts',
      Date.now().toString()
    );
  });

  afterEach(async () => {
    // 清理测试目录
    if (fs.existsSync(testPromptsDir)) {
      await fs.promises.rm(testPromptsDir, { recursive: true, force: true });
    }
  });

  describe('目录管理', () => {
    it('应该返回正确的全局提示词目录路径', () => {
      const expectedPath = path.join(os.homedir(), '.sker', 'prompts');
      expect(provider.getGlobalPromptsDirectory()).toBe(expectedPath);
    });

    it('应该能够创建全局提示词目录', async () => {
      // ❌ 这会失败，因为ensureGlobalPromptsDirectory方法还没有正确实现
      const testProvider = new TestablePromptTemplatesProvider(
        promptManager,
        testPromptsDir
      );

      await testProvider.ensureGlobalPromptsDirectory();

      expect(fs.existsSync(testPromptsDir)).toBe(true);
    });
  });

  describe('模板文件加载', () => {
    it('应该从Markdown文件加载提示词模板', async () => {
      // 创建测试Markdown模板文件
      const templateContent = `请审查以下{{language}}代码：

\`\`\`{{language}}
{{code}}
\`\`\`

请从以下方面进行评估：
1. 代码质量和可读性
2. 性能优化建议
3. 安全性考虑`;

      await fs.promises.mkdir(testPromptsDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(testPromptsDir, 'code-review.md'),
        templateContent
      );

      const testProvider = new TestablePromptTemplatesProvider(
        promptManager,
        testPromptsDir
      );

      // ❌ 这会失败，因为需要重新实现Markdown文件加载
      await testProvider.loadTemplateFromFile('code-review.md');

      const loadedTemplate = promptManager.getPrompt('code-review');
      expect(loadedTemplate).toBeDefined();
      expect(loadedTemplate?.name).toBe('code-review');
      expect(loadedTemplate?.template).toContain('请审查以下{{language}}代码');
    });

    it('应该从Markdown内容解析模板参数', async () => {
      const templateContent = `请分析{{language}}代码：

\`\`\`{{language}}
{{code}}
\`\`\`

分析重点：{{focus}}
详细程度：{{level}}`;

      await fs.promises.mkdir(testPromptsDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(testPromptsDir, 'analyze-code.md'),
        templateContent
      );

      const testProvider = new TestablePromptTemplatesProvider(
        promptManager,
        testPromptsDir
      );

      // ❌ 这会失败，因为需要实现从Markdown解析参数的功能
      await testProvider.loadTemplateFromFile('analyze-code.md');

      const loadedTemplate = promptManager.getPrompt('analyze-code');
      expect(loadedTemplate).toBeDefined();
      expect(loadedTemplate?.arguments).toHaveLength(4);

      const argNames = loadedTemplate?.arguments.map(arg => arg.name);
      expect(argNames).toContain('language');
      expect(argNames).toContain('code');
      expect(argNames).toContain('focus');
      expect(argNames).toContain('level');
    });

    it('应该加载目录中的所有Markdown模板文件', async () => {
      // 创建多个测试Markdown模板文件
      const templates = [
        {
          name: 'code-review',
          content: '请审查以下代码：\n\n```{{language}}\n{{code}}\n```',
        },
        {
          name: 'bug-fix',
          content: '请帮助修复这个bug：\n\n问题描述：{{description}}',
        },
      ];

      await fs.promises.mkdir(testPromptsDir, { recursive: true });

      for (const template of templates) {
        await fs.promises.writeFile(
          path.join(testPromptsDir, `${template.name}.md`),
          template.content
        );
      }

      const testProvider = new TestablePromptTemplatesProvider(
        promptManager,
        testPromptsDir
      );

      // ❌ 这会失败，因为需要重新实现Markdown文件加载
      await testProvider.loadAllTemplates();

      expect(promptManager.getPrompts()).toHaveLength(2);
      expect(promptManager.getPrompt('code-review')).toBeDefined();
      expect(promptManager.getPrompt('bug-fix')).toBeDefined();
    });
  });

  describe('模板保存', () => {
    it('应该保存模板到全局目录', async () => {
      const testTemplate = {
        name: 'save-test',
        description: '保存测试模板',
        template: 'Test {{value}}',
        arguments: [
          {
            name: 'value',
            description: '测试值',
            required: true,
          },
        ],
      };

      const testProvider = new TestablePromptTemplatesProvider(
        promptManager,
        testPromptsDir
      );

      // 测试保存为Markdown格式
      await testProvider.saveTemplate(testTemplate, 'md');

      const savedFile = path.join(testPromptsDir, 'save-test.md');
      expect(fs.existsSync(savedFile)).toBe(true);

      const savedContent = await fs.promises.readFile(savedFile, 'utf8');
      expect(savedContent).toBe(testTemplate.template);
    });

    it('应该创建默认模板文件', async () => {
      const testProvider = new TestablePromptTemplatesProvider(
        promptManager,
        testPromptsDir
      );

      await testProvider.createDefaultTemplates();

      const files = await fs.promises.readdir(testPromptsDir);
      const mdFiles = files.filter(file => file.endsWith('.md'));

      expect(mdFiles.length).toBeGreaterThan(0);
      expect(mdFiles).toContain('default.md');
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的JSON文件', async () => {
      await fs.promises.mkdir(testPromptsDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(testPromptsDir, 'invalid.json'),
        'invalid json content'
      );

      const testProvider = new TestablePromptTemplatesProvider(
        promptManager,
        testPromptsDir
      );

      // 应该不抛出异常，而是优雅地处理错误
      await expect(
        testProvider.loadTemplateFromFile('invalid.json')
      ).resolves.not.toThrow();

      // 无效文件不应该被加载
      expect(promptManager.getPrompt('invalid')).toBeUndefined();
    });

    it('应该在没有模板文件时创建示例文件', async () => {
      // 使用空目录
      const testProvider = new TestablePromptTemplatesProvider(
        promptManager,
        testPromptsDir
      );

      // ❌ 这会失败，因为需要重新实现创建示例文件的逻辑
      await testProvider.loadAllTemplates();

      // 应该创建示例文件而不是回退到内置模板
      const files = await fs.promises.readdir(testPromptsDir);
      const mdFiles = files.filter(file => file.endsWith('.md'));
      expect(mdFiles.length).toBeGreaterThan(0);
      expect(mdFiles).toContain('example-prompt.md');
    });
  });
});

/**
 * 可测试的提示词模板提供者
 * 允许注入自定义目录路径用于测试
 */
class TestablePromptTemplatesProvider extends PromptTemplatesProvider {
  private customPromptsDir: string;

  constructor(promptManager: MCPPromptManager, customPromptsDir: string) {
    super(promptManager);
    this.customPromptsDir = customPromptsDir;
  }

  override getGlobalPromptsDirectory(): string {
    return this.customPromptsDir;
  }

  // 暴露方法用于测试
  override async createExampleTemplate(): Promise<void> {
    return super.createExampleTemplate();
  }
}
