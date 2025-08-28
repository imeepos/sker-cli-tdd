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
    testPromptsDir = path.join(os.tmpdir(), 'sker-test-prompts', Date.now().toString());
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
      const testProvider = new TestablePromptTemplatesProvider(promptManager, testPromptsDir);
      
      await testProvider.ensureGlobalPromptsDirectory();
      
      expect(fs.existsSync(testPromptsDir)).toBe(true);
    });
  });

  describe('模板文件加载', () => {
    it('应该从JSON文件加载提示词模板', async () => {
      // 创建测试模板文件
      const testTemplate = {
        name: 'test-template',
        description: '测试模板',
        template: 'Hello {{name}}!',
        arguments: [
          {
            name: 'name',
            description: '名称',
            required: true
          }
        ]
      };

      await fs.promises.mkdir(testPromptsDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(testPromptsDir, 'test-template.json'),
        JSON.stringify(testTemplate, null, 2)
      );

      const testProvider = new TestablePromptTemplatesProvider(promptManager, testPromptsDir);
      
      // ❌ 这会失败，因为loadTemplateFromFile方法还没有正确实现
      await testProvider.loadTemplateFromFile('test-template.json');
      
      const loadedTemplate = promptManager.getPrompt('test-template');
      expect(loadedTemplate).toBeDefined();
      expect(loadedTemplate?.name).toBe('test-template');
    });

    it('应该验证模板格式', async () => {
      const testProvider = new TestablePromptTemplatesProvider(promptManager, testPromptsDir);
      
      // 有效模板
      const validTemplate = {
        name: 'valid',
        description: '有效模板',
        template: 'Hello!',
        arguments: []
      };
      
      // 无效模板
      const invalidTemplate = {
        name: 'invalid',
        // 缺少必需字段
        template: 'Hello!'
      };
      
      // ❌ 这会失败，因为validateTemplate方法是私有的，需要通过公共方法测试
      expect(testProvider.testValidateTemplate(validTemplate)).toBe(true);
      expect(testProvider.testValidateTemplate(invalidTemplate)).toBe(false);
    });

    it('应该加载目录中的所有JSON模板文件', async () => {
      // 创建多个测试模板文件
      const templates = [
        { name: 'template1', description: '模板1', template: 'Hello {{name}}!', arguments: [] },
        { name: 'template2', description: '模板2', template: 'Hi {{user}}!', arguments: [] }
      ];

      await fs.promises.mkdir(testPromptsDir, { recursive: true });
      
      for (const template of templates) {
        await fs.promises.writeFile(
          path.join(testPromptsDir, `${template.name}.json`),
          JSON.stringify(template, null, 2)
        );
      }

      const testProvider = new TestablePromptTemplatesProvider(promptManager, testPromptsDir);
      
      // ❌ 这会失败，因为loadAllTemplates方法还没有正确实现
      await testProvider.loadAllTemplates();
      
      expect(promptManager.getPrompts()).toHaveLength(2);
      expect(promptManager.getPrompt('template1')).toBeDefined();
      expect(promptManager.getPrompt('template2')).toBeDefined();
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
            required: true
          }
        ]
      };

      const testProvider = new TestablePromptTemplatesProvider(promptManager, testPromptsDir);
      
      // ❌ 这会失败，因为saveTemplate方法还没有正确实现
      await testProvider.saveTemplate(testTemplate);
      
      const savedFile = path.join(testPromptsDir, 'save-test.json');
      expect(fs.existsSync(savedFile)).toBe(true);
      
      const savedContent = JSON.parse(await fs.promises.readFile(savedFile, 'utf8'));
      expect(savedContent.name).toBe('save-test');
    });

    it('应该创建默认模板文件', async () => {
      const testProvider = new TestablePromptTemplatesProvider(promptManager, testPromptsDir);
      
      // ❌ 这会失败，因为createDefaultTemplates方法还没有正确实现
      await testProvider.createDefaultTemplates();
      
      const files = await fs.promises.readdir(testPromptsDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      expect(jsonFiles.length).toBeGreaterThan(0);
      expect(jsonFiles).toContain('code-review.json');
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的JSON文件', async () => {
      await fs.promises.mkdir(testPromptsDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(testPromptsDir, 'invalid.json'),
        'invalid json content'
      );

      const testProvider = new TestablePromptTemplatesProvider(promptManager, testPromptsDir);
      
      // 应该不抛出异常，而是优雅地处理错误
      await expect(testProvider.loadTemplateFromFile('invalid.json')).resolves.not.toThrow();
      
      // 无效文件不应该被加载
      expect(promptManager.getPrompt('invalid')).toBeUndefined();
    });

    it('应该在无法访问全局目录时回退到内置模板', async () => {
      // 使用不存在的目录路径
      const invalidPath = '/invalid/path/that/does/not/exist';
      const testProvider = new TestablePromptTemplatesProvider(promptManager, invalidPath);
      
      // ❌ 这会失败，因为回退机制还没有实现
      await testProvider.loadAllTemplates();
      
      // 应该加载内置模板作为回退
      const prompts = promptManager.getPrompts();
      expect(prompts.length).toBeGreaterThan(0);
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

  // 暴露私有方法用于测试
  testValidateTemplate(template: any): boolean {
    return (this as any).validateTemplate(template);
  }
}
