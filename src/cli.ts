/**
 * 🟢 TDD 绿阶段：CLI 工具最小实现
 * 命令行工具核心功能
 */

import { MCPAIClient, MCPAIConfig } from './mcp-ai-client';
import { ConfigManager } from './config-manager';
import { CLIDaemon } from './cli-daemon';

/**
 * CLI 配置接口
 */
export interface CLIConfig extends MCPAIConfig {
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
  private aiClient?: MCPAIClient;
  private cliDaemon?: CLIDaemon;

  /**
   * 设置 AI 客户端
   */
  setAIClient(client: MCPAIClient): void {
    this.aiClient = client;
  }

  /**
   * 获取 AI 客户端
   */
  getAIClient(): MCPAIClient | undefined {
    return this.aiClient;
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): CLIConfig {
    return {
      provider: 'openai',
      apiKey: '',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
      stream: true,
      interactive: false,
    };
  }

  /**
   * 从ConfigManager加载配置
   */
  loadConfigFromEnv(): CLIConfig {
    const configManager = ConfigManager.getInstance();
    const aiConfig = configManager.getAIConfig();

    return {
      provider: aiConfig.provider,
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      temperature: aiConfig.temperature,
      maxTokens: aiConfig.maxTokens,
      baseURL: aiConfig.baseURL,
    };
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
    if (!this.aiClient) {
      throw new Error('AI 客户端未设置');
    }

    const messages = [{ role: 'user' as const, content: message }];
    const stream = this.aiClient.chatCompletionStream(messages);

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
    if (!this.aiClient) {
      return [];
    }
    return this.aiClient.getAvailableTools();
  }

  /**
   * 带工具调用的聊天
   */
  async chatWithTools(message: string): Promise<any> {
    if (!this.aiClient) {
      throw new Error('AI 客户端未设置');
    }

    const messages = [{ role: 'user' as const, content: message }];
    const response = await this.aiClient.chatCompletionWithTools(messages);

    // 处理工具调用
    const assistantMessage = response.choices[0]?.message;
    if (assistantMessage?.toolCalls && assistantMessage.toolCalls.length > 0) {
      for (const toolCall of assistantMessage.toolCalls) {
        await this.aiClient.executeToolCall(
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments)
        );
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
          message: '你:',
        },
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
🤖 MCP AI CLI 工具

使用方法:
  sker [选项] [消息]
  sker daemon <命令> [选项]
  sker watch <命令> <项目路径> [选项]
  sker context <命令> <项目路径> [选项]

选项:
  --model <model>           指定模型 (默认: gpt-4)
  --temperature <temp>      设置温度参数 (0-1)
  --max-tokens <tokens>     最大令牌数
  --stream                  启用流式输出
  --interactive, -i         交互式模式
  --help, -h               显示帮助信息
  --version, -v            显示版本信息

守护进程命令:
  sker daemon start         启动守护进程
  sker daemon stop          停止守护进程
  sker daemon status        查看守护进程状态

文件监听命令:
  sker watch enable <路径>   启用文件监听
  sker watch disable <路径>  禁用文件监听

上下文命令:
  sker context refresh <路径>  刷新上下文缓存
  sker context clear <路径>    清除上下文缓存

内置工具:
  🗂️  文件工具:         文件读写、搜索、权限管理
  ⚙️  命令工具:         系统命令执行
  🌐 网络工具:         HTTP请求、API调用
  📝 TODO工具:         任务管理、项目跟踪
  🤖 智能体工具:        AI代理和分布式任务处理
  📊 系统上下文工具:     系统信息收集和分析

TODO工具使用示例:
  添加任务:    "使用add_todo工具添加一个高优先级任务"
  查看任务:    "使用list_todos工具显示所有待办事项"
  完成任务:    "使用complete_todo工具标记任务为完成"
  查询任务:    "使用query_todos工具查找高优先级任务"
  统计信息:    "使用todo_stats工具显示任务统计"

一般使用示例:
  sker "你好，世界！"
  sker --interactive
  sker --model gpt-3.5-turbo --stream "解释量子计算"
  sker "添加一个TODO项目：完成项目文档"
  sker "显示所有未完成的高优先级任务"
`;
  }

  /**
   * 获取版本信息
   */
  getVersion(): string {
    return '1.0.0';
  }

  /**
   * 初始化CLI守护进程管理器
   */
  private initializeCLIDaemon(): void {
    if (!this.cliDaemon) {
      const homeDir = require('os').homedir();
      const skerDir = require('path').join(homeDir, '.sker');
      
      this.cliDaemon = new CLIDaemon({
        socketPath: require('path').join(skerDir, 'daemon.sock'),
        pidFile: require('path').join(skerDir, 'daemon.pid'),
        logFile: require('path').join(skerDir, 'daemon.log')
      });
    }
  }

  /**
   * 处理守护进程命令
   */
  async handleDaemonCommand(args: string[]): Promise<void> {
    this.initializeCLIDaemon();
    
    if (args.length < 2) {
      console.log(this.cliDaemon!.getDaemonHelp());
      return;
    }

    const action = args[1];
    const options = this.parseDaemonOptions(args.slice(2));

    switch (action) {
      case 'start':
        const startResult = await this.cliDaemon!.startDaemon(options);
        console.log(startResult.success ? `✅ ${startResult.message}` : `❌ ${startResult.message}`);
        break;
      
      case 'stop':
        const stopResult = await this.cliDaemon!.stopDaemon(options);
        console.log(stopResult.success ? `✅ ${stopResult.message}` : `❌ ${stopResult.message}`);
        break;
      
      case 'status':
        const status = await this.cliDaemon!.getDaemonStatus();
        this.displayDaemonStatus(status);
        break;
      
      default:
        console.log(`❌ 未知的守护进程命令: ${action}`);
        console.log(this.cliDaemon!.getDaemonHelp());
    }
  }

  /**
   * 处理监听命令
   */
  async handleWatchCommand(args: string[]): Promise<void> {
    this.initializeCLIDaemon();
    
    if (args.length < 3) {
      console.log(this.cliDaemon!.getWatchHelp());
      return;
    }

    const action = args[1];
    const projectPath = args[2] || '';
    const options = this.parseWatchOptions(args.slice(3));

    switch (action) {
      case 'enable':
        const enableResult = await this.cliDaemon!.enableWatch(projectPath, options);
        console.log(enableResult.success ? `✅ ${enableResult.message}` : `❌ ${enableResult.message}`);
        break;
      
      case 'disable':
        const disableResult = await this.cliDaemon!.disableWatch(projectPath);
        console.log(disableResult.success ? `✅ ${disableResult.message}` : `❌ ${disableResult.message}`);
        break;
      
      default:
        console.log(`❌ 未知的监听命令: ${action}`);
        console.log(this.cliDaemon!.getWatchHelp());
    }
  }

  /**
   * 处理上下文命令
   */
  async handleContextCommand(args: string[]): Promise<void> {
    this.initializeCLIDaemon();
    
    if (args.length < 3) {
      console.log(this.cliDaemon!.getContextHelp());
      return;
    }

    const action = args[1];
    const projectPath = args[2] || '';
    const options = this.parseContextOptions(args.slice(3));

    switch (action) {
      case 'refresh':
        const refreshResult = await this.cliDaemon!.refreshContext(projectPath, options);
        console.log(refreshResult.success ? `✅ ${refreshResult.message}` : `❌ ${refreshResult.message}`);
        if (refreshResult.success) {
          console.log(`   处理文件: ${refreshResult.filesProcessed}个`);
          console.log(`   耗时: ${refreshResult.totalTime}ms`);
        }
        break;
      
      case 'clear':
        const clearResult = await this.cliDaemon!.clearContext(projectPath);
        console.log(clearResult.success ? `✅ ${clearResult.message}` : `❌ ${clearResult.message}`);
        if (clearResult.success) {
          console.log(`   清除项目: ${clearResult.itemsCleared}个`);
        }
        break;
      
      default:
        console.log(`❌ 未知的上下文命令: ${action}`);
        console.log(this.cliDaemon!.getContextHelp());
    }
  }

  /**
   * 解析守护进程选项
   */
  private parseDaemonOptions(args: string[]): any {
    const options: any = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      switch (arg) {
        case '--background':
          options.background = true;
          break;
        case '--force':
          options.force = true;
          break;
      }
    }
    return options;
  }

  /**
   * 解析监听选项
   */
  private parseWatchOptions(args: string[]): any {
    const options: any = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      switch (arg) {
        case '--debounce':
          options.debounceMs = parseInt(args[++i] || '0', 10);
          break;
      }
    }
    return options;
  }

  /**
   * 解析上下文选项
   */
  private parseContextOptions(args: string[]): any {
    const options: any = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      switch (arg) {
        case '--force':
          options.force = true;
          break;
        case '--patterns':
          options.patterns = [args[++i]];
          break;
        case '--exclude':
          options.exclude = [args[++i]];
          break;
      }
    }
    return options;
  }

  /**
   * 显示守护进程状态
   */
  private displayDaemonStatus(status: any): void {
    console.log('\n📊 守护进程状态:');
    console.log(`状态: ${status.isRunning ? '✅ 运行中' : '❌ 未运行'}`);
    if (status.isRunning) {
      console.log(`进程ID: ${status.pid}`);
      console.log(`运行时长: ${status.uptime}秒`);
      console.log(`内存使用: ${status.memoryUsage}MB`);
      console.log(`监听项目: ${status.projectCount}个`);
      console.log(`健康状态: ${status.health.isHealthy ? '✅ 健康' : '⚠️ 异常'}`);
      console.log(`最后检查: ${status.health.lastCheck.toLocaleString()}`);
    }
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
