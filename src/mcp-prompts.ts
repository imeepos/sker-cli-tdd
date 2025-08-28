/**
 * 🟢 TDD 绿阶段：MCP Prompt 提示词功能实现
 * 遵循 TDD 原则：编写刚好让测试通过的最简代码
 * 负责 MCP 服务器的提示词管理和渲染功能
 */

/**
 * Prompt 参数定义
 */
export interface MCPPromptArgument {
  /** 参数名称 */
  name: string;
  /** 参数描述 */
  description: string;
  /** 是否必需 */
  required: boolean;
  /** 默认值（可选） */
  default?: string;
}

/**
 * MCP Prompt 提示词接口
 */
export interface MCPPrompt {
  /** 提示词名称 */
  name: string;
  /** 提示词描述 */
  description: string;
  /** 提示词模板 */
  template: string;
  /** 参数列表 */
  arguments: MCPPromptArgument[];
}

/**
 * MCP Prompt 管理器
 * 负责提示词的注册、管理和渲染
 */
export class MCPPromptManager {
  private readonly prompts: Map<string, MCPPrompt> = new Map();

  /**
   * 注册一个提示词
   * @param prompt 要注册的提示词
   * @throws Error 如果同名提示词已存在
   */
  registerPrompt(prompt: MCPPrompt): void {
    if (this.prompts.has(prompt.name)) {
      throw new Error(`Prompt "${prompt.name}" 已存在`);
    }
    this.prompts.set(prompt.name, prompt);
  }

  /**
   * 获取所有已注册的提示词
   * @returns 所有提示词的数组
   */
  getPrompts(): MCPPrompt[] {
    return Array.from(this.prompts.values());
  }

  /**
   * 按名称获取提示词
   * @param name 提示词名称
   * @returns 找到的提示词，如果不存在则返回 undefined
   */
  getPrompt(name: string): MCPPrompt | undefined {
    return this.prompts.get(name);
  }

  /**
   * 渲染提示词模板
   * @param name 提示词名称
   * @param args 渲染参数
   * @returns 渲染后的文本
   * @throws Error 如果提示词不存在或参数验证失败
   */
  async renderPrompt(name: string, args: Record<string, any>): Promise<string> {
    const prompt = this.prompts.get(name);
    if (!prompt) {
      throw new Error(`Prompt "${name}" 不存在`);
    }

    // 验证必需参数
    for (const arg of prompt.arguments) {
      if (arg.required && !(arg.name in args)) {
        throw new Error(`必需参数 "${arg.name}" 未提供`);
      }
    }

    // 准备渲染参数（包含默认值）
    const renderArgs: Record<string, any> = { ...args };
    for (const arg of prompt.arguments) {
      if (!(arg.name in renderArgs) && arg.default !== undefined) {
        renderArgs[arg.name] = arg.default;
      }
    }

    // 渲染模板
    let result = prompt.template;
    for (const [key, value] of Object.entries(renderArgs)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return result;
  }
}
