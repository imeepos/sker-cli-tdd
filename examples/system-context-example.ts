/**
 * 🚀 系统上下文探索工具使用示例
 * 演示如何使用系统上下文工具进行环境探索和分析
 */

import { SystemContextToolsProvider } from '../src/system-context-tools';
import { MCPServer } from '../src/mcp-server';
import { MCPWorkspaceManager } from '../src/mcp-workspace';
import { ToolManager } from '../src/tool-manager';

/**
 * 基础系统上下文示例
 */
export async function runBasicSystemContextExample(): Promise<void> {
  console.log('\n🚀 启动基础系统上下文示例...\n');

  // 创建必要的组件
  const server = new MCPServer();
  const workspaceManager = new MCPWorkspaceManager();
  const toolManager = new ToolManager(server, workspaceManager);
  const systemContextProvider = new SystemContextToolsProvider();
  
  // 注册系统上下文工具
  toolManager.registerToolProvider(systemContextProvider);

  try {
    // 1. 获取系统摘要
    console.log('📋 获取系统摘要...');
    const summaryResult = await toolManager.executeTool('get_system_summary', {});
    if (summaryResult.success) {
      console.log('✅ 系统摘要:');
      console.log(summaryResult.summary);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 2. 获取操作系统信息
    console.log('💻 获取操作系统信息...');
    const osResult = await toolManager.executeTool('get_os_info', {});
    if (osResult.success) {
      console.log('✅ 操作系统信息:');
      console.log(`   平台: ${osResult.os.platform}`);
      console.log(`   类型: ${osResult.os.type}`);
      console.log(`   版本: ${osResult.os.version}`);
      console.log(`   架构: ${osResult.os.arch}`);
      console.log(`   主机名: ${osResult.os.hostname}`);
      console.log(`   是否Windows: ${osResult.isWindows ? '是' : '否'}`);
      console.log(`   是否Linux: ${osResult.isLinux ? '是' : '否'}`);
      console.log(`   是否macOS: ${osResult.isMacOS ? '是' : '否'}`);
      
      console.log('\n   系统资源:');
      console.log(`   总内存: ${Math.round(osResult.system.totalMemory / 1024 / 1024 / 1024)}GB`);
      console.log(`   可用内存: ${Math.round(osResult.system.freeMemory / 1024 / 1024 / 1024)}GB`);
      console.log(`   CPU核心数: ${osResult.system.cpuCount}`);
      console.log(`   系统运行时间: ${Math.round(osResult.system.uptime / 3600)}小时`);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 3. 获取命令行工具信息
    console.log('🔧 获取命令行工具信息...');
    const toolsResult = await toolManager.executeTool('get_command_line_tools', {});
    if (toolsResult.success) {
      console.log(`✅ 发现 ${toolsResult.count} 个命令行工具:`);
      toolsResult.tools.forEach((tool: any) => {
        const status = tool.available ? '✅' : '❌';
        const version = tool.version ? ` (${tool.version})` : '';
        console.log(`   ${status} ${tool.name}${version}`);
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 4. 获取Shell信息
    console.log('🐚 获取Shell信息...');
    const shellResult = await toolManager.executeTool('get_shell_info', {});
    if (shellResult.success) {
      console.log(`✅ 发现 ${shellResult.count} 个Shell:`);
      shellResult.shells.forEach((shell: any) => {
        const status = shell.available ? '✅' : '❌';
        const version = shell.version ? ` (${shell.version})` : '';
        const isDefault = shell.isDefault ? ' [默认]' : '';
        console.log(`   ${status} ${shell.name}${version}${isDefault}`);
      });
      
      console.log(`\n   当前Shell: ${shellResult.currentShell.name}`);
      console.log(`   支持PowerShell: ${shellResult.hasPowerShell ? '是' : '否'}`);
      console.log(`   支持Bash: ${shellResult.hasBash ? '是' : '否'}`);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 5. 获取网络信息
    console.log('🌐 获取网络信息...');
    const networkResult = await toolManager.executeTool('get_network_info', {});
    if (networkResult.success) {
      console.log(`✅ 网络接口信息:`);
      console.log(`   接口数量: ${networkResult.interfaceCount}`);
      console.log(`   互联网连接: ${networkResult.hasInternet ? '正常' : '异常'}`);
      console.log(`   DNS解析: ${networkResult.hasDNS ? '正常' : '异常'}`);
      console.log(`   外部接口数: ${networkResult.externalInterfaces.length}`);
      
      if (networkResult.externalInterfaces.length > 0) {
        console.log('\n   外部网络接口:');
        networkResult.externalInterfaces.forEach((iface: any) => {
          console.log(`   - ${iface.name}: ${iface.address} (${iface.family})`);
        });
      }
    }

  } catch (error) {
    console.error(`❌ 示例执行失败: ${(error as Error).message}`);
  }
}

/**
 * 系统兼容性分析示例
 */
export async function runSystemCompatibilityExample(): Promise<void> {
  console.log('\n🚀 启动系统兼容性分析示例...\n');

  const server = new MCPServer();
  const workspaceManager = new MCPWorkspaceManager();
  const toolManager = new ToolManager(server, workspaceManager);
  const systemContextProvider = new SystemContextToolsProvider();
  
  toolManager.registerToolProvider(systemContextProvider);

  try {
    // 获取完整系统上下文
    const contextResult = await toolManager.executeTool('get_system_context', {});
    
    if (contextResult.success) {
      const context = contextResult.context;
      
      console.log('🔍 系统兼容性分析报告:');
      console.log('=' .repeat(50));
      
      // 分析开发环境
      console.log('\n📦 开发环境分析:');
      const devTools = ['node', 'npm', 'git', 'python', 'java', 'docker'];
      const availableDevTools = context.commandLineTools.filter((tool: any) => 
        devTools.includes(tool.name) && tool.available
      );
      
      console.log(`   可用开发工具: ${availableDevTools.length}/${devTools.length}`);
      availableDevTools.forEach((tool: any) => {
        console.log(`   ✅ ${tool.name}: ${tool.version || '未知版本'}`);
      });
      
      const missingDevTools = devTools.filter(toolName => 
        !context.commandLineTools.some((tool: any) => tool.name === toolName && tool.available)
      );
      if (missingDevTools.length > 0) {
        console.log('\n   缺失的开发工具:');
        missingDevTools.forEach(toolName => {
          console.log(`   ❌ ${toolName}`);
        });
      }
      
      // 分析Shell兼容性
      console.log('\n🐚 Shell兼容性分析:');
      if (context.os.platform === 'win32') {
        const hasPowerShell = context.shells.some((shell: any) => 
          shell.name.toLowerCase().includes('powershell') || shell.name === 'pwsh'
        );
        console.log(`   PowerShell支持: ${hasPowerShell ? '✅ 是' : '❌ 否'}`);
        
        const hasCmd = context.shells.some((shell: any) => shell.name === 'cmd');
        console.log(`   CMD支持: ${hasCmd ? '✅ 是' : '❌ 否'}`);
        
        const hasBash = context.shells.some((shell: any) => shell.name === 'bash');
        console.log(`   Bash支持: ${hasBash ? '✅ 是 (WSL或Git Bash)' : '❌ 否'}`);
      } else {
        const hasBash = context.shells.some((shell: any) => shell.name === 'bash');
        console.log(`   Bash支持: ${hasBash ? '✅ 是' : '❌ 否'}`);
        
        const hasZsh = context.shells.some((shell: any) => shell.name === 'zsh');
        console.log(`   Zsh支持: ${hasZsh ? '✅ 是' : '❌ 否'}`);
      }
      
      // 分析系统资源
      console.log('\n💾 系统资源分析:');
      const memoryGB = Math.round(context.system.totalMemory / 1024 / 1024 / 1024);
      const freeMemoryGB = Math.round(context.system.freeMemory / 1024 / 1024 / 1024);
      const memoryUsage = Math.round((1 - context.system.freeMemory / context.system.totalMemory) * 100);
      
      console.log(`   总内存: ${memoryGB}GB`);
      console.log(`   可用内存: ${freeMemoryGB}GB`);
      console.log(`   内存使用率: ${memoryUsage}%`);
      console.log(`   CPU核心数: ${context.system.cpuCount}`);
      
      if (memoryGB < 4) {
        console.log('   ⚠️ 内存较少，可能影响大型项目开发');
      } else if (memoryGB >= 16) {
        console.log('   ✅ 内存充足，适合大型项目开发');
      } else {
        console.log('   ✅ 内存适中，适合中小型项目开发');
      }
      
      // 网络连接分析
      console.log('\n🌐 网络连接分析:');
      console.log(`   互联网连接: ${context.network.connectivity.internet ? '✅ 正常' : '❌ 异常'}`);
      console.log(`   DNS解析: ${context.network.connectivity.dns ? '✅ 正常' : '❌ 异常'}`);
      
      if (!context.network.connectivity.internet) {
        console.log('   ⚠️ 无法访问互联网，可能影响包管理和在线资源获取');
      }
      
      console.log('\n📊 总体评估:');
      let score = 0;
      let maxScore = 0;
      
      // 开发工具评分
      score += availableDevTools.length * 10;
      maxScore += devTools.length * 10;
      
      // Shell评分
      score += context.shells.length * 5;
      maxScore += 20;
      
      // 内存评分
      if (memoryGB >= 16) score += 20;
      else if (memoryGB >= 8) score += 15;
      else if (memoryGB >= 4) score += 10;
      maxScore += 20;
      
      // 网络评分
      if (context.network.connectivity.internet) score += 10;
      maxScore += 10;
      
      const percentage = Math.round((score / maxScore) * 100);
      console.log(`   兼容性评分: ${score}/${maxScore} (${percentage}%)`);
      
      if (percentage >= 80) {
        console.log('   🎉 系统环境优秀，完全适合开发工作');
      } else if (percentage >= 60) {
        console.log('   ✅ 系统环境良好，适合大部分开发工作');
      } else {
        console.log('   ⚠️ 系统环境需要改进，建议安装缺失的工具');
      }
    }

  } catch (error) {
    console.error(`❌ 兼容性分析失败: ${(error as Error).message}`);
  }
}

/**
 * 主函数 - 运行所有示例
 */
export async function runAllSystemContextExamples(): Promise<void> {
  console.log('🔍 系统上下文探索工具完整示例');
  console.log('=' .repeat(60));

  await runBasicSystemContextExample();
  await runSystemCompatibilityExample();

  console.log('\n✅ 所有系统上下文示例完成！');
  console.log('🎯 AI现在可以深入了解系统环境并提供针对性建议！');
  console.log('=' .repeat(60));
}

// 如果直接运行此文件
if (require.main === module) {
  runAllSystemContextExamples().catch(console.error);
}
