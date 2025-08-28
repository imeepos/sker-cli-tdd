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
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      for (const file of jsonFiles) {
        await this.loadTemplateFromFile(file);
      }

      console.log(`✅ 从 ${this.getGlobalPromptsDirectory()} 加载了 ${jsonFiles.length} 个提示词模板`);

      // 如果没有找到任何模板文件，回退到内置模板
      if (jsonFiles.length === 0) {
        console.log('🔄 未找到全局提示词模板，使用内置模板');
        this.registerBuiltinTemplates();
      }
    } catch (error) {
      console.warn(`无法访问全局提示词目录: ${(error as Error).message}`);
      // 如果无法访问全局目录，回退到内置模板
      console.log('🔄 使用内置提示词模板作为回退方案');
      this.registerBuiltinTemplates();
    }
  }

  /**
   * 从指定文件加载提示词模板
   */
  async loadTemplateFromFile(filename: string): Promise<void> {
    const filePath = path.join(this.getGlobalPromptsDirectory(), filename);

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const template: MCPPrompt = JSON.parse(content);

      // 验证模板格式
      if (this.validateTemplate(template)) {
        this.promptManager.registerPrompt(template);
        console.log(`✅ 加载提示词模板: ${template.name}`);
      } else {
        console.warn(`❌ 提示词模板格式无效: ${filename}`);
      }
    } catch (error) {
      console.warn(`无法加载提示词模板 ${filename}: ${(error as Error).message}`);
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
  async saveTemplate(template: MCPPrompt): Promise<void> {
    await this.ensureGlobalPromptsDirectory();

    const filename = `${template.name}.json`;
    const filePath = path.join(this.getGlobalPromptsDirectory(), filename);

    try {
      const content = JSON.stringify(template, null, 2);
      await fs.promises.writeFile(filePath, content, 'utf8');
      console.log(`✅ 保存提示词模板: ${template.name} -> ${filename}`);
    } catch (error) {
      console.error(`无法保存提示词模板 ${template.name}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 创建默认的提示词模板文件
   */
  async createDefaultTemplates(): Promise<void> {
    await this.ensureGlobalPromptsDirectory();

    const defaultTemplates = this.getBuiltinTemplates();

    for (const template of defaultTemplates) {
      const filename = `${template.name}.json`;
      const filePath = path.join(this.getGlobalPromptsDirectory(), filename);

      // 只有文件不存在时才创建
      if (!fs.existsSync(filePath)) {
        await this.saveTemplate(template);
      }
    }

    console.log(`✅ 创建了 ${defaultTemplates.length} 个默认提示词模板`);
  }

  /**
   * 注册内置模板（作为回退方案）
   */
  private registerBuiltinTemplates(): void {
    console.log('🔄 使用内置提示词模板作为回退方案');
    const templates = this.getBuiltinTemplates();

    for (const template of templates) {
      this.promptManager.registerPrompt(template);
    }

    console.log(`✅ 注册了 ${templates.length} 个内置提示词模板`);
  }

  /**
   * 获取内置提示词模板列表
   */
  private getBuiltinTemplates(): MCPPrompt[] {
    return [
      // 代码审查提示词
      {
        name: 'code-review',
        description: '代码审查提示词',
        template: `请对以下 {{language}} 代码进行详细审查：

代码：
\`\`\`{{language}}
{{code}}
\`\`\`

请从以下方面进行评估：
1. 代码质量和可读性
2. 性能优化建议
3. 安全性考虑
4. 最佳实践遵循情况
5. 潜在的 bug 或问题

审查重点：{{focus}}`,
        arguments: [
          {
            name: 'language',
            description: '编程语言',
            required: true
          },
          {
            name: 'code',
            description: '要审查的代码',
            required: true
          },
          {
            name: 'focus',
            description: '审查重点',
            required: false,
            default: '代码质量和性能'
          }
        ]
      },
      // 代码解释提示词
      {
        name: 'code-explain',
        description: '代码解释提示词',
        template: `请详细解释以下 {{language}} 代码的功能和工作原理：

\`\`\`{{language}}
{{code}}
\`\`\`

请包括：
1. 代码的主要功能
2. 关键算法或逻辑
3. 重要的设计模式或技术
4. 代码的执行流程

解释级别：{{level}}`,
        arguments: [
          {
            name: 'language',
            description: '编程语言',
            required: true
          },
          {
            name: 'code',
            description: '要解释的代码',
            required: true
          },
          {
            name: 'level',
            description: '解释详细程度',
            required: false,
            default: '中等详细'
          }
        ]
      },

      // 代码重构提示词
      {
        name: 'code-refactor',
        description: '代码重构建议提示词',
        template: `请为以下 {{language}} 代码提供重构建议：

当前代码：
\`\`\`{{language}}
{{code}}
\`\`\`

重构目标：{{goal}}

请提供：
1. 具体的重构建议
2. 重构后的代码示例
3. 重构的好处和理由
4. 需要注意的风险点`,
        arguments: [
          {
            name: 'language',
            description: '编程语言',
            required: true
          },
          {
            name: 'code',
            description: '要重构的代码',
            required: true
          },
          {
            name: 'goal',
            description: '重构目标',
            required: false,
            default: '提高代码质量和可维护性'
          }
        ]
      }
    ];
  }



}
