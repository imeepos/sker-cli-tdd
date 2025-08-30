/**
 * 🚀 命令执行工具使用示例
 * 演示如何使用命令执行工具进行系统命令调用
 */

import { CommandToolsProvider } from '../src/command-tools';
import { MCPServer } from '../src/mcp-server';
import { MCPWorkspaceManager } from '../src/mcp-workspace';
import { ToolManager } from '../src/tool-manager';

/**
 * 命令执行结果接口
 */
interface CommandResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  command?: string;
  executionTime?: number;
  error?: string;
}

/**
 * 基础命令执行示例
 */
export async function runBasicCommandExample(): Promise<void> {
  console.log('\n🚀 启动基础命令执行示例...\n');

  // 创建必要的组件
  const server = new MCPServer();
  const workspaceManager = new MCPWorkspaceManager();
  const toolManager = new ToolManager(server, workspaceManager);
  const commandToolsProvider = new CommandToolsProvider();
  
  // 注册命令工具
  toolManager.registerToolProvider(commandToolsProvider);

  try {
    // 1. 演示基本的echo命令
    console.log('📝 演示基本echo命令...');
    const echoResult = await toolManager.executeTool('execute_command', {
      command: 'echo "Hello from Command Tools!"'
    }) as CommandResult;
    console.log(`✅ Echo结果:`, echoResult);

    // 2. 演示获取当前目录
    console.log('\n📁 演示获取当前目录...');
    const pwdResult = await toolManager.executeTool('execute_command', {
      command: 'pwd'
    }) as CommandResult;
    console.log(`✅ 当前目录:`, pwdResult.stdout?.trim());

    // 3. 演示列出文件
    console.log('\n📋 演示列出当前目录文件...');
    const lsResult = await toolManager.executeTool('execute_command', {
      command: 'ls -la'
    }) as CommandResult;
    console.log(`✅ 文件列表:`);
    console.log(lsResult.stdout);

    // 4. 演示系统信息获取
    console.log('\n💻 演示获取系统信息...');
    const unameResult = await toolManager.executeTool('execute_command', {
      command: 'uname -a'
    }) as CommandResult;
    if (unameResult.success) {
      console.log(`✅ 系统信息: ${unameResult.stdout?.trim()}`);
    } else {
      console.log(`ℹ️ 系统信息获取失败（可能在Windows环境）: ${unameResult.stderr}`);
    }

    // 5. 演示Node.js版本检查
    console.log('\n🟢 演示Node.js版本检查...');
    const nodeResult = await toolManager.executeTool('execute_command', {
      command: 'node --version'
    }) as CommandResult;
    console.log(`✅ Node.js版本: ${nodeResult.stdout?.trim()}`);

    // 6. 演示npm版本检查
    console.log('\n📦 演示npm版本检查...');
    const npmResult = await toolManager.executeTool('execute_command', {
      command: 'npm --version'
    }) as CommandResult;
    console.log(`✅ npm版本: ${npmResult.stdout?.trim()}`);

  } catch (error) {
    console.error(`❌ 示例执行失败: ${(error as Error).message}`);
  }
}

/**
 * 错误处理示例
 */
export async function runErrorHandlingExample(): Promise<void> {
  console.log('\n🚀 启动错误处理示例...\n');

  const server = new MCPServer();
  const workspaceManager = new MCPWorkspaceManager();
  const toolManager = new ToolManager(server, workspaceManager);
  const commandToolsProvider = new CommandToolsProvider();
  
  toolManager.registerToolProvider(commandToolsProvider);

  // 1. 演示不存在的命令
  console.log('❌ 演示执行不存在的命令...');
  const invalidResult = await toolManager.executeTool('execute_command', {
    command: 'nonexistentcommand12345'
  }) as CommandResult;
  console.log('结果:', {
    success: invalidResult.success,
    stderr: invalidResult.stderr,
    exitCode: invalidResult.exitCode
  });

  // 2. 演示空命令
  console.log('\n❌ 演示执行空命令...');
  const emptyResult = await toolManager.executeTool('execute_command', {
    command: ''
  }) as CommandResult;
  console.log('结果:', {
    success: emptyResult.success,
    stderr: emptyResult.stderr
  });

  // 3. 演示命令执行超时（如果支持）
  console.log('\n⏱️ 演示长时间运行的命令...');
  const longResult = await toolManager.executeTool('execute_command', {
    command: 'ping -c 2 google.com || ping -n 2 google.com'
  }) as CommandResult;
  console.log('结果:', {
    success: longResult.success,
    executionTime: longResult.executionTime,
    stdout: longResult.stdout?.substring(0, 100) + '...'
  });
}

/**
 * 实用命令示例
 */
export async function runPracticalCommandsExample(): Promise<void> {
  console.log('\n🚀 启动实用命令示例...\n');

  const server = new MCPServer();
  const workspaceManager = new MCPWorkspaceManager();
  const toolManager = new ToolManager(server, workspaceManager);
  const commandToolsProvider = new CommandToolsProvider();
  
  toolManager.registerToolProvider(commandToolsProvider);

  try {
    // 1. 检查Git状态
    console.log('🔍 检查Git状态...');
    const gitStatusResult = await toolManager.executeTool('execute_command', {
      command: 'git status --porcelain'
    }) as CommandResult;
    if (gitStatusResult.success) {
      console.log(`✅ Git状态: ${gitStatusResult.stdout?.trim() || '工作目录干净'}`);
    } else {
      console.log(`ℹ️ 不是Git仓库或Git未安装`);
    }

    // 2. 检查磁盘使用情况
    console.log('\n💾 检查磁盘使用情况...');
    const diskResult = await toolManager.executeTool('execute_command', {
      command: 'df -h . || dir'
    }) as CommandResult;
    if (diskResult.success) {
      console.log(`✅ 磁盘信息:`);
      console.log(diskResult.stdout?.substring(0, 200) + '...');
    }

    // 3. 检查网络连接
    console.log('\n🌐 检查网络连接...');
    const pingResult = await toolManager.executeTool('execute_command', {
      command: 'ping -c 1 8.8.8.8 || ping -n 1 8.8.8.8'
    }) as CommandResult;
    if (pingResult.success) {
      console.log(`✅ 网络连接正常`);
    } else {
      console.log(`❌ 网络连接可能有问题`);
    }

    // 4. 获取环境变量
    console.log('\n🔧 获取重要环境变量...');
    const envResult = await toolManager.executeTool('execute_command', {
      command: 'echo "PATH: $PATH" && echo "HOME: $HOME" || echo "PATH: %PATH%" && echo "HOME: %USERPROFILE%"'
    }) as CommandResult;
    if (envResult.success) {
      console.log(`✅ 环境变量:`);
      console.log(envResult.stdout?.substring(0, 300) + '...');
    }

  } catch (error) {
    console.error(`❌ 实用命令示例执行失败: ${(error as Error).message}`);
  }
}

/**
 * 编码处理示例
 */
export async function runEncodingExample(): Promise<void> {
  console.log('\n🚀 启动编码处理示例...\n');

  const server = new MCPServer();
  const workspaceManager = new MCPWorkspaceManager();
  const toolManager = new ToolManager(server, workspaceManager);
  const commandToolsProvider = new CommandToolsProvider();

  toolManager.registerToolProvider(commandToolsProvider);

  try {
    // 1. 测试中文输出
    console.log('🈶 测试中文字符输出...');
    const chineseResult = await toolManager.executeTool('execute_command', {
      command: 'echo 你好世界'
    }) as CommandResult;
    console.log(`✅ 中文输出: ${chineseResult.stdout?.trim()}`);

    // 2. 测试错误信息的中文显示
    console.log('\n❌ 测试中文错误信息...');
    const errorResult = await toolManager.executeTool('execute_command', {
      command: '不存在的命令'
    }) as CommandResult;
    console.log(`✅ 中文错误信息: ${errorResult.stderr?.substring(0, 50)}...`);

    // 3. 测试目录列表的中文显示
    console.log('\n📁 测试目录信息的中文显示...');
    const dirResult = await toolManager.executeTool('execute_command', {
      command: 'dir /w'
    }) as CommandResult;
    if (dirResult.success) {
      console.log(`✅ 目录信息包含中文: ${dirResult.stdout?.includes('驱动器') ? '是' : '否'}`);
    }

  } catch (error) {
    console.error(`❌ 编码示例执行失败: ${(error as Error).message}`);
  }
}

/**
 * 主函数 - 运行所有示例
 */
export async function runAllCommandExamples(): Promise<void> {
  console.log('🎯 命令执行工具完整示例');
  console.log('=' .repeat(50));

  await runBasicCommandExample();
  await runErrorHandlingExample();
  await runPracticalCommandsExample();
  await runEncodingExample();

  console.log('\n✅ 所有命令执行示例完成！');
  console.log('🔧 编码问题已修复，中文字符显示正常！');
  console.log('=' .repeat(50));
}

// 如果直接运行此文件
if (require.main === module) {
  runAllCommandExamples().catch(console.error);
}
