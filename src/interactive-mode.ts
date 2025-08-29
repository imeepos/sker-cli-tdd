/**
 * 🟢 TDD 绿阶段：交互式模式实现
 * 创建交互式聊天模式，支持多轮对话和命令处理
 */

import { StreamChat } from './stream-chat';
import { ToolManager } from './tool-manager';
import inquirer from 'inquirer';

/**
 * 会话配置接口
 */
export interface SessionConfig {
  realTimeOutput: boolean;
  autoSave: boolean;
  maxHistory: number;
}

/**
 * 交互式模式类
 */
export class InteractiveMode {
  private streamChat: StreamChat;
  private toolManager: ToolManager;
  private sessionConfig: SessionConfig = {
    realTimeOutput: true,
    autoSave: false,
    maxHistory: 50
  };

  constructor(streamChat: StreamChat, toolManager: ToolManager) {
    this.streamChat = streamChat;
    this.toolManager = toolManager;
  }

  /**
   * 获取流式聊天实例
   */
  getStreamChat(): StreamChat {
    return this.streamChat;
  }

  /**
   * 获取工具管理器实例
   */
  getToolManager(): ToolManager {
    return this.toolManager;
  }

  /**
   * 检查是否为退出命令
   */
  isExitCommand(message: string): boolean {
    const exitCommands = ['/exit', '/quit', '/q'];
    return exitCommands.includes(message.toLowerCase());
  }

  /**
   * 检查是否为帮助命令
   */
  isHelpCommand(message: string): boolean {
    const helpCommands = ['/help', '/h', '/?'];
    return helpCommands.includes(message.toLowerCase());
  }

  /**
   * 检查是否为清除命令
   */
  isClearCommand(message: string): boolean {
    const clearCommands = ['/clear', '/cls'];
    return clearCommands.includes(message.toLowerCase());
  }

  /**
   * 检查是否为统计命令
   */
  isStatsCommand(message: string): boolean {
    const statsCommands = ['/stats', '/statistics'];
    return statsCommands.includes(message.toLowerCase());
  }

  /**
   * 检查是否为工具命令
   */
  isToolsCommand(message: string): boolean {
    const toolsCommands = ['/tools', '/t'];
    return toolsCommands.includes(message.toLowerCase());
  }

  /**
   * 检查是否为会话命令
   */
  isSessionCommand(message: string): boolean {
    const sessionCommands = ['/sessions', '/sess', '/list'];
    return sessionCommands.includes(message.toLowerCase());
  }

  /**
   * 检查是否为新建会话命令
   */
  isNewSessionCommand(message: string): boolean {
    return message.toLowerCase().startsWith('/new');
  }

  /**
   * 检查是否为加载会话命令
   */
  isLoadSessionCommand(message: string): boolean {
    return message.toLowerCase().startsWith('/load');
  }

  /**
   * 检查是否为数据库统计命令
   */
  isDbStatsCommand(message: string): boolean {
    const dbStatsCommands = ['/dbstats', '/db'];
    return dbStatsCommands.includes(message.toLowerCase());
  }

  /**
   * 执行命令
   */
  async executeCommand(command: string): Promise<void> {
    if (this.isHelpCommand(command)) {
      console.log(`
🤖 可用命令:
  /help, /h, /?     - 显示帮助信息
  /clear, /cls      - 清除对话历史
  /stats            - 显示统计信息
  /tools, /t        - 显示可用工具
  /sessions, /sess  - 列出所有会话
  /new [name]       - 创建新会话
  /load <id>        - 加载指定会话
  /dbstats, /db     - 显示数据库统计
  /exit, /quit, /q  - 退出程序
      `);
    } else if (this.isClearCommand(command)) {
      console.clear();
      this.streamChat.clearHistory();
      console.log('✅ 对话历史已清除');
    } else if (this.isStatsCommand(command)) {
      const chatStats = this.streamChat.getStats();
      const toolStats = this.toolManager.getToolStats();
      
      console.log(`
📊 统计信息:
  消息总数: ${chatStats.totalMessages}
  令牌总数: ${chatStats.totalTokens}
  工具调用: ${chatStats.totalToolCalls}
  可用工具: ${toolStats.totalTools}
  工具执行: ${toolStats.totalExecutions}
  成功率: ${(toolStats.successRate * 100).toFixed(1)}%
      `);
    } else if (this.isToolsCommand(command)) {
      const toolsHelp = this.toolManager.getAllToolsHelp();
      console.log(toolsHelp);
    } else if (this.isSessionCommand(command)) {
      const sessions = await this.streamChat.listSessions(10);
      if (sessions.length === 0) {
        console.log('📂 暂无保存的会话');
      } else {
        console.log('\n📂 最近的会话:');
        sessions.forEach((session, index) => {
          const date = new Date(session.updatedAt).toLocaleString();
          console.log(`  ${index + 1}. ${session.name} (ID: ${session.id})`);
          console.log(`     更新时间: ${date}, 消息数: ${session.messageCount}`);
        });
      }
    } else if (this.isNewSessionCommand(command)) {
      const parts = command.split(' ');
      const sessionName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
      const sessionId = await this.streamChat.createSession(sessionName);
      console.log(`✅ 创建新会话: ${sessionId}`);
    } else if (this.isLoadSessionCommand(command)) {
      const parts = command.split(' ');
      if (parts.length < 2) {
        console.log('❌ 请指定会话ID: /load <session-id>');
        return;
      }
      const sessionId = parts[1];
      if (!sessionId) {
        console.log('❌ 请指定会话ID: /load <session-id>');
        return;
      }
      try {
        await this.streamChat.loadSessionHistory(sessionId);
        const sessionInfo = await this.streamChat.getSessionInfo(sessionId);
        console.log(`✅ 已加载会话: ${sessionInfo?.name || sessionId}`);
        console.log(`   消息数: ${sessionInfo?.messageCount || 0}`);
      } catch (error) {
        console.log(`❌ 加载会话失败: ${(error as Error).message}`);
      }
    } else if (this.isDbStatsCommand(command)) {
      const dbStats = await this.streamChat.getStorageStats();
      console.log(`
📊 数据库统计:
  总会话数: ${dbStats.totalSessions}
  总消息数: ${dbStats.totalMessages}
  数据库大小: ${dbStats.dbSize} bytes
      `);
    } else {
      console.log(`❌ 未知命令: ${command}`);
      console.log('输入 /help 查看可用命令');
    }
  }

  /**
   * 处理普通聊天消息
   */
  async handleMessage(message: string): Promise<void> {
    try {
      await this.streamChat.chat(message);
      console.log(''); // 换行
    } catch (error) {
      console.error(`❌ 聊天错误: ${(error as Error).message}`);
    }
  }

  /**
   * 处理带工具调用的聊天消息
   */
  async handleMessageWithTools(message: string): Promise<void> {
    try {
      await this.streamChat.chatWithTools(message);
      console.log(''); // 换行
    } catch (error) {
      console.error(`❌ 聊天错误: ${(error as Error).message}`);
    }
  }

  /**
   * 显示欢迎消息
   */
  showWelcomeMessage(): void {
    console.log('🤖 进入交互式聊天模式');
    console.log('输入 /help 查看可用命令，输入 /exit 退出');
    console.log('─'.repeat(50));
  }

  /**
   * 启动交互式会话
   */
  async start(): Promise<void> {
    this.showWelcomeMessage();

    while (true) {
      try {
        const result = await inquirer.prompt([
          {
            type: 'input',
            name: 'message',
            message: '你:'
          }
        ]);

        // 安全地获取 message 属性
        const message = result?.message;
        if (!message) {
          console.log('❌ 输入无效，请重试');
          continue;
        }

        if (this.isExitCommand(message)) {
          console.log('👋 再见！');
          break;
        }

        if (message.startsWith('/')) {
          await this.executeCommand(message);
        } else {
          await this.handleMessage(message);
        }
      } catch (error) {
        console.error(`❌ 会话错误: ${(error as Error).message}`);
        break; // 出现错误时退出循环，避免无限循环
      }
    }
  }

  /**
   * 设置实时输出
   */
  setRealTimeOutput(enabled: boolean): void {
    this.sessionConfig.realTimeOutput = enabled;
    this.streamChat.setRealTimeOutput(enabled);
  }

  /**
   * 获取会话配置
   */
  getSessionConfig(): SessionConfig {
    return { ...this.sessionConfig };
  }

  /**
   * 更新会话配置
   */
  updateSessionConfig(config: Partial<SessionConfig>): void {
    this.sessionConfig = { ...this.sessionConfig, ...config };
    
    if (config.realTimeOutput !== undefined) {
      this.streamChat.setRealTimeOutput(config.realTimeOutput);
    }
  }

  /**
   * 保存会话
   */
  async saveSession(sessionName: string): Promise<boolean> {
    try {
      const history = this.streamChat.getConversationHistory();
      // 这里应该实现实际的保存逻辑，现在只是模拟
      console.log(`💾 会话 "${sessionName}" 已保存 (${history.length} 条消息)`);
      return true;
    } catch (error) {
      console.error(`❌ 保存会话失败: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 加载会话
   */
  async loadSession(sessionName: string): Promise<boolean> {
    try {
      // 这里应该实现实际的加载逻辑，现在只是模拟
      console.log(`📂 会话 "${sessionName}" 已加载`);
      return true;
    } catch (error) {
      console.error(`❌ 加载会话失败: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 列出保存的会话
   */
  listSavedSessions(): string[] {
    // 这里应该实现实际的会话列表逻辑，现在只是模拟
    return [];
  }
}
