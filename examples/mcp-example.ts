/**
 * 🔄 TDD 重构阶段：MCP 服务器使用示例
 * 演示如何使用带有计算器工具的 MCP 服务器
 * 遵循 TDD 原则：基于已测试功能的示例
 */

import { MCPServer } from '../src/mcp-server';
import { CalculatorToolsProvider } from '../src/calculator-tools';

/**
 * MCP 服务器的使用示例
 * 演示完整的工作流程：
 * 1. 创建 MCP 服务器
 * 2. 注册计算器工具
 * 3. 启动服务器
 * 4. 执行工具
 * 5. 管理资源
 */
export async function runMCPExample(): Promise<void> {
  console.log('🚀 启动 MCP 服务器示例...\n');

  // 1. 创建 MCP 服务器实例
  const server = new MCPServer();
  console.log(`📋 服务器名称: ${server.getName()}`);
  console.log(`📦 服务器版本: ${server.getVersion()}\n`);

  // 2. 创建计算器工具提供者并注册工具
  console.log('🔧 注册计算器工具...');
  const calculatorProvider = new CalculatorToolsProvider();

  // 将计算器工具注册到服务器
  calculatorProvider.getTools().forEach(tool => {
    server.registerTool(tool);
  });

  const tools = server.getTools();
  console.log(`✅ 已注册 ${tools.length} 个工具:`);
  tools.forEach(tool => {
    console.log(`   - ${tool.name}: ${tool.description}`);
  });
  console.log('');

  // 3. 启动服务器
  console.log('🟢 启动服务器...');
  await server.start();
  console.log(`✅ 服务器运行中: ${server.isRunning()}\n`);

  // 4. 执行计算器操作
  console.log('🧮 执行计算器操作...');

  try {
    // 加法
    const addResult = await server.executeTool('add', { a: 15, b: 27 });
    console.log(`   15 + 27 = ${addResult.result}`);

    // 减法
    const subtractResult = await server.executeTool('subtract', { a: 50, b: 18 });
    console.log(`   50 - 18 = ${subtractResult.result}`);

    // Multiplication
    const multiplyResult = await server.executeTool('multiply', { a: 8, b: 9 });
    console.log(`   8 × 9 = ${multiplyResult.result}`);

    // Division
    const divideResult = await server.executeTool('divide', { a: 84, b: 12 });
    console.log(`   84 ÷ 12 = ${divideResult.result}`);

    console.log('');

    // Error handling example
    console.log('⚠️  Testing error handling...');
    try {
      await server.executeTool('divide', { a: 10, b: 0 });
    } catch (error) {
      console.log(`   Division by zero error: ${(error as Error).message}`);
    }

    try {
      await server.executeTool('nonexistent', {});
    } catch (error) {
      console.log(`   Tool not found error: ${(error as Error).message}`);
    }

  } catch (error) {
    console.error('❌ Error executing tools:', error);
  }

  console.log('');

  // 5. Register and manage resources
  console.log('📁 Managing resources...');
  
  const sampleResource = {
    uri: 'file://calculator-results.json',
    name: 'Calculator Results',
    mimeType: 'application/json',
    description: 'Sample calculation results'
  };

  server.registerResource(sampleResource);
  console.log(`✅ Registered resource: ${sampleResource.name}`);

  const resources = server.getResources();
  console.log(`📊 Total resources: ${resources.length}`);

  try {
    const resourceContent = await server.readResource(sampleResource.uri);
    console.log(`📖 Resource content type: ${resourceContent.mimeType}`);
  } catch (error) {
    console.error('❌ Error reading resource:', error);
  }

  console.log('');

  // 6. Stop the server
  console.log('🔴 Stopping server...');
  await server.stop();
  console.log(`✅ Server stopped: ${!server.isRunning()}`);

  console.log('\n🎉 MCP Server Example completed successfully!');
}

/**
 * Run the example if this file is executed directly
 */
if (require.main === module) {
  runMCPExample().catch(console.error);
}
