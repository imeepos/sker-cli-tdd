/**
 * 🔄 TDD 重构阶段：全局提示词模板加载器
 * 从用户目录 ~/.sker/prompts 加载提示词模板
 * 遵循单一职责原则：专门负责从全局目录加载提示词模板
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MCPPromptManager, MCPPrompt } from './mcp-prompts';

/**
 * 全局提示词模板加载器
 * 负责从用户目录 ~/.sker/prompts 加载提示词模板
 */
export class PromptTemplatesProvider {
  private readonly promptManager: MCPPromptManager;
  private readonly globalPromptsDir: string;

  constructor(promptManager: MCPPromptManager) {
    this.promptManager = promptManager;
    this.globalPromptsDir = path.join(os.homedir(), '.sker', 'prompts');
  }

  /**
   * 获取全局提示词目录路径
   */
  getGlobalPromptsDirectory(): string {
    return this.globalPromptsDir;
  }

  /**
   * 确保全局提示词目录存在
   */
  async ensureGlobalPromptsDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.getGlobalPromptsDirectory(), { recursive: true });
    } catch (error) {
      console.warn(`无法创建全局提示词目录 ${this.getGlobalPromptsDirectory()}: ${(error as Error).message}`);
      throw error; // 重新抛出异常，让调用者处理
    }
  }

  /**
   * 从全局目录加载所有提示词模板
   */
  async loadAllTemplates(): Promise<void> {
    try {
      await this.ensureGlobalPromptsDirectory();

      const files = await fs.promises.readdir(this.getGlobalPromptsDirectory());
      const mdFiles = files.filter(file => file.endsWith('.md'));

      for (const file of mdFiles) {
        await this.loadTemplateFromFile(file);
      }

      console.log(`✅ 从 ${this.getGlobalPromptsDirectory()} 加载了 ${mdFiles.length} 个提示词模板`);

      // 如果没有找到任何模板文件，创建示例文件
      if (mdFiles.length === 0) {
        console.log('� 未找到提示词模板，创建示例文件');
        await this.createExampleTemplate();
      }
    } catch (error) {
      console.warn(`无法访问全局提示词目录: ${(error as Error).message}`);
      // 如果无法访问全局目录，尝试创建示例文件
      try {
        await this.createExampleTemplate();
      } catch (createError) {
        console.warn(`无法创建示例文件: ${(createError as Error).message}`);
      }
    }
  }

  /**
   * 从指定文件加载提示词模板
   */
  async loadTemplateFromFile(filename: string): Promise<void> {
    const filePath = path.join(this.getGlobalPromptsDirectory(), filename);

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');

      if (filename.endsWith('.md')) {
        // 处理Markdown文件
        const template = this.parseMarkdownTemplate(filename, content);
        this.promptManager.registerPrompt(template);
        console.log(`✅ 加载提示词模板: ${template.name}`);
      } else if (filename.endsWith('.json')) {
        // 处理JSON文件（向后兼容）
        const template: MCPPrompt = JSON.parse(content);

        // 验证模板格式
        if (this.validateTemplate(template)) {
          this.promptManager.registerPrompt(template);
          console.log(`✅ 加载提示词模板: ${template.name}`);
        } else {
          console.warn(`❌ 提示词模板格式无效: ${filename}`);
        }
      }
    } catch (error) {
      console.warn(`无法加载提示词模板 ${filename}: ${(error as Error).message}`);
    }
  }

  /**
   * 从Markdown内容解析提示词模板
   */
  private parseMarkdownTemplate(filename: string, content: string): MCPPrompt {
    // 从文件名提取模板名称（去掉.md扩展名）
    const name = path.basename(filename, '.md');

    // 解析模板参数（查找{{参数名}}格式）
    const paramRegex = /\{\{(\w+)\}\}/g;
    const params = new Set<string>();
    let match;

    while ((match = paramRegex.exec(content)) !== null) {
      if (match[1]) {
        params.add(match[1]);
      }
    }

    // 创建参数定义
    const arguments_: MCPPrompt['arguments'] = Array.from(params).map(param => ({
      name: param,
      description: `${param}参数`,
      required: true
    }));

    return {
      name,
      description: `${name}提示词模板`,
      template: content,
      arguments: arguments_
    };
  }

  /**
   * 创建示例模板文件
   */
  async createExampleTemplate(): Promise<void> {
    await this.ensureGlobalPromptsDirectory();

    const exampleContent = `请分析以下{{language}}代码：

\`\`\`{{language}}
{{code}}
\`\`\`

请从以下方面进行分析：
1. 代码功能和逻辑
2. 代码质量评估
3. 潜在问题识别
4. 改进建议

分析重点：{{focus}}
详细程度：{{level}}`;

    const examplePath = path.join(this.getGlobalPromptsDirectory(), 'example-prompt.md');

    try {
      await fs.promises.writeFile(examplePath, exampleContent, 'utf8');
      console.log('✅ 创建示例模板文件: example-prompt.md');

      // 加载刚创建的示例模板
      await this.loadTemplateFromFile('example-prompt.md');
    } catch (error) {
      console.error(`无法创建示例模板文件: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 验证提示词模板格式
   */
  private validateTemplate(template: any): template is MCPPrompt {
    return (
      typeof template === 'object' &&
      typeof template.name === 'string' &&
      typeof template.description === 'string' &&
      typeof template.template === 'string' &&
      Array.isArray(template.arguments)
    );
  }

  /**
   * 保存提示词模板到全局目录
   */
  async saveTemplate(template: MCPPrompt, format: 'md' | 'json' = 'md'): Promise<void> {
    await this.ensureGlobalPromptsDirectory();

    const filename = `${template.name}.${format}`;
    const filePath = path.join(this.getGlobalPromptsDirectory(), filename);

    try {
      let content: string;

      if (format === 'md') {
        // 保存为Markdown格式
        content = template.template;
      } else {
        // 保存为JSON格式（向后兼容）
        content = JSON.stringify(template, null, 2);
      }

      await fs.promises.writeFile(filePath, content, 'utf8');
      console.log(`✅ 保存提示词模板: ${template.name} -> ${filename}`);
    } catch (error) {
      console.error(`无法保存提示词模板 ${template.name}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 创建默认模板文件（向后兼容，现在创建default.md）
   */
  async createDefaultTemplates(): Promise<void> {
    await this.ensureGlobalPromptsDirectory();

    const defaultPath = path.join(this.getGlobalPromptsDirectory(), 'default.md');

    // 只有文件不存在时才创建
    if (!fs.existsSync(defaultPath)) {
      const defaultContent = `请分析以下{{language}}代码：

\`\`\`{{language}}
{{code}}
\`\`\`

请从以下方面进行分析：
1. 代码功能和逻辑
2. 代码质量评估
3. 潜在问题识别
4. 改进建议

分析重点：{{focus}}
详细程度：{{level}}`;

      await fs.promises.writeFile(defaultPath, defaultContent, 'utf8');
      console.log('✅ 创建了默认提示词模板: default.md');
    } else {
      console.log('📋 默认模板文件已存在');
    }
  }
}
