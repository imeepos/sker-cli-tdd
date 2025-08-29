/**
 * 🟢 TDD 绿阶段：CLI 工具最小实现
 * 命令行工具核心功能
 */

import { MCPOpenAIClient, MCPOpenAIConfig } from './mcp-openai';

/**
 * CLI 配置接口
 */
export interface CLIConfig extends MCPOpenAIConfig {
  stream?: boolean;
  interactive?: boolean;
}

/**
 * 命令行选项接口
 */
export interface CLIOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  interactive?: boolean;
  help?: boolean;
  version?: boolean;
}

/**
 * CLI 工具类
 */
export class CLI {
  private openaiClient?: MCPOpenAIClient;

  /**
   * 设置 OpenAI 客户端
   */
  setOpenAIClient(client: MCPOpenAIClient): void {
    this.openaiClient = client;
  }

  /**
   * 获取 OpenAI 客户端
   */
  getOpenAIClient(): MCPOpenAIClient | undefined {
    return this.openaiClient;
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): CLIConfig {
    return {
      apiKey: '',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
      stream: true,
      interactive: false
    };
  }

  /**
   * 从环境变量加载配置
   */
  loadConfigFromEnv(): CLIConfig {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY 环境变量未设置');
    }

    const config: CLIConfig = {
      apiKey,
      model: process.env['OPENAI_MODEL'] || 'gpt-4',
      temperature: process.env['OPENAI_TEMPERATURE'] ? parseFloat(process.env['OPENAI_TEMPERATURE']) : 0.7,
      maxTokens: process.env['OPENAI_MAX_TOKENS'] ? parseInt(process.env['OPENAI_MAX_TOKENS']) : 2000
    };

    if (process.env['OPENAI_BASE_URL']) {
      config.baseURL = process.env['OPENAI_BASE_URL'];
    }

    return config;
  }

  /**
   * 解析命令行参数
   */
  parseArgs(args: string[]): CLIOptions {
    const options: CLIOptions = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--model':
          options.model = args[++i];
          break;
        case '--temperature':
          const tempValue = args[++i];
          if (tempValue) options.temperature = parseFloat(tempValue);
          break;
        case '--max-tokens':
          const tokensValue = args[++i];
          if (tokensValue) options.maxTokens = parseInt(tokensValue);
          break;
        case '--stream':
          options.stream = true;
          break;
        case '--interactive':
          options.interactive = true;
          break;
        case '--help':
        case '-h':
          options.help = true;
          break;
        case '--version':
        case '-v':
          options.version = true;
          break;
      }
    }

    return options;
  }

  /**
   * 流式聊天
   */
  async streamChat(message: string): Promise<string> {
    if (!this.openaiClient) {
      throw new Error('OpenAI 客户端未设置');
    }

    const messages = [{ role: 'user' as const, content: message }];
    const stream = await this.openaiClient.chatCompletionStream(messages);

    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        process.stdout.write(content);
        fullResponse += content;
      }
    }

    return fullResponse;
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): any[] {
    if (!this.openaiClient) {
      return [];
    }
    return this.openaiClient.getOpenAITools();
  }

  /**
   * 带工具调用的聊天
   */
  async chatWithTools(message: string): Promise<any> {
    if (!this.openaiClient) {
      throw new Error('OpenAI 客户端未设置');
    }

    const messages = [{ role: 'user' as const, content: message }];
    const response = await this.openaiClient.chatCompletionWithTools(messages);

    // 处理工具调用
    const assistantMessage = response.choices[0]?.message;
    if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      for (const toolCall of assistantMessage.tool_calls) {
        await this.openaiClient.executeToolCall(toolCall);
      }
    }

    return response;
  }

  /**
   * 启动交互式模式
   */
  async startInteractiveMode(): Promise<void> {
    const inquirer = require('inquirer');
    
    console.log('🤖 进入交互式聊天模式 (输入 /exit 退出)');
    
    while (true) {
      const { message } = await inquirer.prompt([
        {
          type: 'input',
          name: 'message',
          message: '你:'
        }
      ]);

      if (message === '/exit') {
        console.log('👋 再见！');
        break;
      }

      try {
        await this.streamChat(message);
        console.log('\n');
      } catch (error) {
        console.error('❌ 错误:', (error as Error).message);
      }
    }
  }

  /**
   * 获取帮助文本
   */
  getHelpText(): string {
    return `
🤖 MCP OpenAI CLI 工具

使用方法:
  sker-cli [选项] [消息]

选项:
  --model <model>           指定模型 (默认: gpt-4)
  --temperature <temp>      设置温度参数 (0-1)
  --max-tokens <tokens>     最大令牌数
  --stream                  启用流式输出
  --interactive, -i         交互式模式
  --help, -h               显示帮助信息
  --version, -v            显示版本信息

示例:
  sker-cli "你好，世界！"
  sker-cli --interactive
  sker-cli --model gpt-3.5-turbo --stream "解释量子计算"
`;
  }

  /**
   * 获取版本信息
   */
  getVersion(): string {
    return '1.0.0';
  }

  /**
   * 验证配置
   */
  validateConfig(config: CLIConfig): void {
    if (!config.apiKey) {
      throw new Error('配置无效: 缺少 API 密钥');
    }
    if (!config.model) {
      throw new Error('配置无效: 缺少模型名称');
    }
  }

  /**
   * 错误处理
   */
  async handleError(error: Error): Promise<void> {
    console.error(`❌ 错误: ${error.message}`);
  }
}
