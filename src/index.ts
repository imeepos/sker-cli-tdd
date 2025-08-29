#!/usr/bin/env node

/**
 * 🚀 Sker CLI - MCP OpenAI 命令行工具
 * 支持流式输出的 AI 聊天工具
 */

import { CLI } from './cli.js';
import { MCPOpenAIClient } from './mcp-openai.js';
import { MCPServer } from './mcp-server.js';
import { MCPWorkspaceManager } from './mcp-workspace.js';
import { StreamChat } from './stream-chat.js';
import { ToolManager } from './tool-manager.js';
import { InteractiveMode } from './interactive-mode.js';
import { FileToolsProvider } from './file-tools.js';
import { CommandToolsProvider } from './command-tools.js';
import { FetchToolsProvider } from './fetch-tools.js';
import { SystemContextToolsProvider } from './system-context-tools.js';

/**
 * 主程序入口
 */
async function main() {
  try {
    // 创建 CLI 实例
    const cli = new CLI();

    // 解析命令行参数
    const args = process.argv.slice(2);
    const options = cli.parseArgs(args);

    // 显示帮助信息
    if (options.help) {
      console.log(cli.getHelpText());
      process.exit(0);
    }

    // 显示版本信息
    if (options.version) {
      console.log(`Sker CLI v${cli.getVersion()}`);
      process.exit(0);
    }

    // 加载配置
    const config = cli.loadConfigFromEnv();

    // 应用命令行选项覆盖
    if (options.model) config.model = options.model;
    if (options.temperature !== undefined) config.temperature = options.temperature;
    if (options.maxTokens !== undefined) config.maxTokens = options.maxTokens;

    // 验证配置
    cli.validateConfig(config);

    // 创建 MCP 组件
    const mcpServer = new MCPServer();
    const workspaceManager = new MCPWorkspaceManager();
    const openaiClient = new MCPOpenAIClient(config, mcpServer);

    // 设置 MCP 服务器
    mcpServer.setWorkspaceManager(workspaceManager);

    // 注册内置工具
    const fileToolsProvider = new FileToolsProvider();
    const commandToolsProvider = new CommandToolsProvider();
    const fetchToolsProvider = new FetchToolsProvider();
    const systemContextToolsProvider = new SystemContextToolsProvider();
    const toolManager = new ToolManager(mcpServer, workspaceManager);
    toolManager.registerToolProvider(fileToolsProvider);
    toolManager.registerToolProvider(commandToolsProvider);
    toolManager.registerToolProvider(fetchToolsProvider);
    toolManager.registerToolProvider(systemContextToolsProvider);

    // 创建流式聊天
    const streamChat = new StreamChat(openaiClient, mcpServer);
    streamChat.setRealTimeOutput(options.stream !== false);

    // 设置 CLI 客户端
    cli.setOpenAIClient(openaiClient);

    // 交互式模式
    if (options.interactive) {
      const interactiveMode = new InteractiveMode(streamChat, toolManager);
      await interactiveMode.start();
      return;
    }

    // 单次聊天模式
    const message = args.find(arg => !arg.startsWith('-'));
    if (message) {
      console.log('🤖 AI 助手:');
      console.log('─'.repeat(50));

      try {
        if (toolManager.getAvailableTools().length > 0) {
          await streamChat.chatWithTools(message);
        } else {
          await streamChat.chat(message);
        }
        console.log('\n');
      } catch (error) {
        console.error(`❌ 错误: ${(error as Error).message}`);
        process.exit(1);
      }
    } else {
      // 没有消息，显示帮助
      console.log('❌ 请提供消息或使用 --interactive 模式');
      console.log(cli.getHelpText());
      process.exit(1);
    }

  } catch (error) {
    console.error(`❌ 启动失败: ${(error as Error).message}`);
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n👋 再见！');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 再见！');
  process.exit(0);
});

// 启动程序
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 程序异常:', error.message);
    process.exit(1);
  });
}
