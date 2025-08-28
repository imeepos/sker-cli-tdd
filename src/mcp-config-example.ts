/**
 * 🔄 TDD 重构阶段：MCP 配置持久化使用示例
 * 演示如何使用 MCP 配置管理器进行持久化存储
 * 遵循 TDD 原则：基于已测试功能的示例
 */

import { MCPServer } from './mcp-server';
import { CalculatorToolsProvider } from './calculator-tools';
import { MCPConfig } from './mcp-config';
import * as path from 'path';

/**
 * MCP 配置持久化的使用示例
 * 演示完整的配置管理工作流程：
 * 1. 创建服务器和配置管理器
 * 2. 注册工具和资源
 * 3. 导出配置到文件
 * 4. 从文件加载配置
 * 5. 自动保存功能
 */
export async function runMCPConfigExample(): Promise<void> {
  console.log('🚀 启动 MCP 配置持久化示例...\n');

  const configPath = path.join(process.cwd(), 'example-mcp-config.json');
  
  // 1. 创建服务器和配置管理器
  console.log('📋 创建 MCP 服务器和配置管理器...');
  const server = new MCPServer();
  const config = new MCPConfig(configPath);
  
  console.log(`📦 服务器名称: ${server.getName()}`);
  console.log(`📁 配置文件路径: ${config.getConfigPath()}\n`);

  // 2. 注册工具和资源
  console.log('🔧 注册工具和资源...');
  
  // 注册计算器工具
  const calculatorProvider = new CalculatorToolsProvider();
  calculatorProvider.getTools().forEach(tool => {
    server.registerTool(tool);
  });
  
  // 注册一些示例资源
  server.registerResource({
    uri: 'file://calculator-results.json',
    name: '计算器结果',
    mimeType: 'application/json',
    description: '存储计算器操作结果的文件'
  });
  
  server.registerResource({
    uri: 'file://user-preferences.json',
    name: '用户偏好设置',
    mimeType: 'application/json',
    description: '用户的个性化设置'
  });
  
  const tools = server.getTools();
  const resources = server.getResources();
  console.log(`✅ 已注册 ${tools.length} 个工具和 ${resources.length} 个资源\n`);

  // 3. 导出配置到文件
  console.log('💾 导出配置到文件...');
  try {
    await config.exportFromServer(server);
    console.log('✅ 配置已成功导出到文件\n');
  } catch (error) {
    console.error('❌ 导出配置失败:', (error as Error).message);
    return;
  }

  // 4. 创建新服务器并从文件加载配置
  console.log('📂 创建新服务器并从文件加载配置...');
  const newServer = new MCPServer();
  
  try {
    await config.importToServer(newServer);
    const loadedTools = newServer.getTools();
    const loadedResources = newServer.getResources();
    
    console.log(`✅ 已从配置文件加载 ${loadedTools.length} 个工具和 ${loadedResources.length} 个资源`);
    console.log('📋 加载的工具:');
    loadedTools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
    console.log('📋 加载的资源:');
    loadedResources.forEach(resource => {
      console.log(`   - ${resource.name} (${resource.uri})`);
    });
    console.log('');
  } catch (error) {
    console.error('❌ 导入配置失败:', (error as Error).message);
    return;
  }

  // 5. 演示自动保存功能
  console.log('🔄 演示自动保存功能...');
  const autoSaveServer = new MCPServer();
  const autoSaveConfig = new MCPConfig(path.join(process.cwd(), 'auto-save-config.json'));
  
  // 启用自动保存
  autoSaveConfig.enableAutoSave(autoSaveServer);
  console.log('✅ 已启用自动保存模式');
  
  // 注册一个新工具
  autoSaveServer.registerTool({
    name: 'auto-save-demo',
    description: '自动保存演示工具',
    handler: async (params: any) => {
      return { message: '这是自动保存的演示', params };
    }
  });
  
  console.log('🔧 已注册新工具，等待自动保存...');
  
  // 等待自动保存完成
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // 验证自动保存
  try {
    const autoSavedConfig = await autoSaveConfig.loadConfig();
    if (autoSavedConfig.tools.some(tool => tool.name === 'auto-save-demo')) {
      console.log('✅ 自动保存功能正常工作');
    } else {
      console.log('⚠️  自动保存可能未完成');
    }
  } catch (error) {
    console.warn('⚠️  验证自动保存时出错:', (error as Error).message);
  }
  
  // 禁用自动保存
  autoSaveConfig.disableAutoSave();
  console.log('🔴 已禁用自动保存模式\n');

  // 6. 配置验证演示
  console.log('🔍 演示配置验证功能...');
  
  const validConfig = {
    tools: [
      {
        name: 'valid-tool',
        description: '有效的工具配置'
      }
    ],
    resources: [
      {
        uri: 'file://valid.txt',
        name: '有效资源',
        mimeType: 'text/plain'
      }
    ]
  };
  
  const invalidConfig = {
    tools: [
      {
        // 缺少必需的 name 字段
        description: '无效的工具配置'
      }
    ],
    resources: []
  };
  
  console.log(`✅ 有效配置验证结果: ${config.validateConfig(validConfig)}`);
  console.log(`❌ 无效配置验证结果: ${config.validateConfig(invalidConfig)}\n`);

  // 7. 清理示例文件
  console.log('🧹 清理示例配置文件...');
  try {
    const fs = require('fs');
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      console.log('✅ 已删除示例配置文件');
    }
    
    const autoSaveConfigPath = autoSaveConfig.getConfigPath();
    if (fs.existsSync(autoSaveConfigPath)) {
      fs.unlinkSync(autoSaveConfigPath);
      console.log('✅ 已删除自动保存配置文件');
    }
  } catch (error) {
    console.warn('⚠️  清理文件时出错:', (error as Error).message);
  }

  console.log('\n🎉 MCP 配置持久化示例完成！');
}

/**
 * 如果直接运行此文件则执行示例
 */
if (require.main === module) {
  runMCPConfigExample().catch(console.error);
}
