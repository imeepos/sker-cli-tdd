/**
 * 🔄 TDD 重构阶段：MCP 工作空间功能使用示例
 * 演示如何使用 MCP 服务器的工作空间功能
 * 遵循 TDD 原则：基于已测试功能的示例
 */

import { MCPServer } from '../src/mcp-server';
import { MCPWorkspaceManager } from '../src/mcp-workspace';
import { MCPPromptManager } from '../src/mcp-prompts';
import { CalculatorToolsProvider } from '../src/calculator-tools';

/**
 * MCP 工作空间功能的使用示例
 * 演示完整的工作空间管理工作流程：
 * 1. 创建服务器和工作空间管理器
 * 2. 创建多个工作空间
 * 3. 向全局和工作空间添加资源
 * 4. 演示工作空间隔离和资源合并
 * 5. 工作空间间的切换
 */
export async function runMCPWorkspaceExample(): Promise<void> {
  console.log('🚀 启动 MCP 工作空间功能示例...\n');

  // 1. 创建服务器和管理器
  console.log('📋 创建 MCP 服务器和管理器...');
  const server = new MCPServer();
  const workspaceManager = new MCPWorkspaceManager();
  const promptManager = new MCPPromptManager();
  
  // 集成管理器到服务器
  server.setWorkspaceManager(workspaceManager);
  server.setPromptManager(promptManager);
  
  console.log(`📦 服务器名称: ${server.getName()}`);
  console.log(`✅ 工作空间管理器已集成到服务器`);
  console.log(`✅ 提示词管理器已集成到服务器\n`);

  // 2. 查看默认全局工作空间
  console.log('🌍 查看默认全局工作空间...');
  const globalWorkspace = workspaceManager.getGlobalWorkspace();
  console.log(`📁 全局工作空间: ${globalWorkspace.name} (${globalWorkspace.id})`);
  console.log(`📝 描述: ${globalWorkspace.description}`);
  console.log(`🔧 工具数量: ${globalWorkspace.tools.length}`);
  console.log(`📄 资源数量: ${globalWorkspace.resources.length}`);
  console.log(`💬 提示词数量: ${globalWorkspace.prompts.length}\n`);

  // 3. 向全局工作空间添加通用资源
  console.log('🔧 向全局工作空间添加通用工具和资源...');
  
  // 添加计算器工具到全局工作空间
  const calculatorProvider = new CalculatorToolsProvider();
  const calculatorTools = calculatorProvider.getTools();
  calculatorTools.forEach(tool => {
    workspaceManager.addToolToWorkspace('global', tool);
  });
  
  // 添加全局资源
  workspaceManager.addResourceToWorkspace('global', {
    uri: 'file://global-config.json',
    name: '全局配置文件',
    mimeType: 'application/json',
    description: '所有工作空间共享的全局配置'
  });
  
  // 添加全局提示词
  workspaceManager.addPromptToWorkspace('global', {
    name: 'global-greeting',
    description: '全局问候提示词',
    template: '你好，{{name}}！欢迎使用 {{workspace}} 工作空间。',
    arguments: [
      { name: 'name', description: '用户名称', required: true },
      { name: 'workspace', description: '工作空间名称', required: false, default: 'MCP' }
    ]
  });
  
  console.log(`✅ 已向全局工作空间添加 ${calculatorTools.length} 个工具`);
  console.log(`✅ 已向全局工作空间添加 1 个资源`);
  console.log(`✅ 已向全局工作空间添加 1 个提示词\n`);

  // 4. 创建项目工作空间
  console.log('🏗️ 创建项目工作空间...');
  
  const projectAWorkspace = workspaceManager.createWorkspace({
    id: 'project-a',
    name: '项目 A',
    description: '电商平台开发项目'
  });
  
  const projectBWorkspace = workspaceManager.createWorkspace({
    id: 'project-b',
    name: '项目 B',
    description: '数据分析平台项目'
  });
  
  console.log(`📁 创建工作空间: ${projectAWorkspace.name} (${projectAWorkspace.id})`);
  console.log(`📁 创建工作空间: ${projectBWorkspace.name} (${projectBWorkspace.id})\n`);

  // 5. 向项目工作空间添加特定资源
  console.log('📦 向项目工作空间添加特定资源...');
  
  // 项目 A 的特定工具和资源
  workspaceManager.addToolToWorkspace('project-a', {
    name: 'deploy-ecommerce',
    description: '部署电商平台',
    schema: {
      type: 'object',
      properties: {
        environment: { type: 'string', description: '部署环境' }
      }
    },
    handler: async (params) => ({
      result: `电商平台已部署到 ${params.environment} 环境`
    })
  });
  
  workspaceManager.addResourceToWorkspace('project-a', {
    uri: 'file://project-a/database.sql',
    name: '电商数据库脚本',
    mimeType: 'application/sql',
    description: '电商平台数据库初始化脚本'
  });
  
  workspaceManager.addPromptToWorkspace('project-a', {
    name: 'ecommerce-review',
    description: '电商代码审查提示词',
    template: '请审查以下电商平台的 {{component}} 组件代码：\n\n{{code}}\n\n重点关注：{{focus}}',
    arguments: [
      { name: 'component', description: '组件名称', required: true },
      { name: 'code', description: '代码内容', required: true },
      { name: 'focus', description: '审查重点', required: false, default: '安全性和性能' }
    ]
  });
  
  // 项目 B 的特定工具和资源
  workspaceManager.addToolToWorkspace('project-b', {
    name: 'analyze-data',
    description: '分析数据',
    schema: {
      type: 'object',
      properties: {
        dataset: { type: 'string', description: '数据集名称' }
      }
    },
    handler: async (params) => ({
      result: `数据集 ${params.dataset} 分析完成`,
      metrics: { rows: 1000, columns: 50 }
    })
  });
  
  workspaceManager.addResourceToWorkspace('project-b', {
    uri: 'file://project-b/data-model.py',
    name: '数据模型脚本',
    mimeType: 'text/x-python',
    description: '数据分析模型定义'
  });
  
  workspaceManager.addPromptToWorkspace('project-b', {
    name: 'data-analysis',
    description: '数据分析提示词',
    template: '请分析以下数据集：{{dataset}}\n\n分析维度：{{dimensions}}\n\n输出格式：{{format}}',
    arguments: [
      { name: 'dataset', description: '数据集描述', required: true },
      { name: 'dimensions', description: '分析维度', required: false, default: '趋势、分布、异常' },
      { name: 'format', description: '输出格式', required: false, default: '图表和文字报告' }
    ]
  });
  
  console.log(`✅ 项目 A 工作空间: 1 个工具, 1 个资源, 1 个提示词`);
  console.log(`✅ 项目 B 工作空间: 1 个工具, 1 个资源, 1 个提示词\n`);

  // 6. 演示工作空间切换和资源合并
  console.log('🔄 演示工作空间切换和资源合并...\n');
  
  // 切换到项目 A 工作空间
  console.log('📁 切换到项目 A 工作空间:');
  server.setCurrentWorkspace('project-a');
  const currentWorkspace = server.getCurrentWorkspace();
  console.log(`当前工作空间: ${currentWorkspace.name}`);
  
  const projectATools = server.getTools();
  console.log(`可用工具数量: ${projectATools.length}`);
  console.log(`工具列表:`);
  projectATools.forEach(tool => {
    console.log(`   - ${tool.name}: ${tool.description}`);
  });
  
  // 执行项目 A 特定工具
  console.log('\n🔧 执行项目 A 特定工具:');
  try {
    const deployResult = await server.executeTool('deploy-ecommerce', { environment: 'staging' });
    console.log(`✅ 部署结果: ${deployResult.result}`);
  } catch (error) {
    console.error(`❌ 执行失败: ${(error as Error).message}`);
  }
  
  // 执行全局工具
  console.log('\n🧮 执行全局计算器工具:');
  try {
    const calcResult = await server.executeTool('add', { a: 10, b: 20 });
    console.log(`✅ 计算结果: ${calcResult.result}`);
  } catch (error) {
    console.error(`❌ 执行失败: ${(error as Error).message}`);
  }
  
  console.log('');
  
  // 切换到项目 B 工作空间
  console.log('📁 切换到项目 B 工作空间:');
  server.setCurrentWorkspace('project-b');
  const projectBWorkspaceInfo = server.getCurrentWorkspace();
  console.log(`当前工作空间: ${projectBWorkspaceInfo.name}`);
  
  const projectBTools = server.getTools();
  console.log(`可用工具数量: ${projectBTools.length}`);
  console.log(`工具列表:`);
  projectBTools.forEach(tool => {
    console.log(`   - ${tool.name}: ${tool.description}`);
  });
  
  // 执行项目 B 特定工具
  console.log('\n📊 执行项目 B 特定工具:');
  try {
    const analysisResult = await server.executeTool('analyze-data', { dataset: 'sales-2024' });
    console.log(`✅ 分析结果: ${analysisResult.result}`);
    console.log(`📈 数据指标: ${JSON.stringify(analysisResult.metrics)}`);
  } catch (error) {
    console.error(`❌ 执行失败: ${(error as Error).message}`);
  }
  
  // 尝试执行项目 A 的工具（应该失败）
  console.log('\n❌ 尝试在项目 B 中执行项目 A 的工具:');
  try {
    await server.executeTool('deploy-ecommerce', { environment: 'production' });
  } catch (error) {
    console.log(`✅ 正确隔离: ${(error as Error).message}`);
  }
  
  console.log('');

  // 7. 显示最终统计
  console.log('📊 工作空间统计:');
  const allWorkspaces = workspaceManager.getAllWorkspaces();
  console.log(`✅ 总共创建了 ${allWorkspaces.length} 个工作空间:`);
  
  allWorkspaces.forEach(workspace => {
    console.log(`   📁 ${workspace.name} (${workspace.id}):`);
    console.log(`      - 工具: ${workspace.tools.length} 个`);
    console.log(`      - 资源: ${workspace.resources.length} 个`);
    console.log(`      - 提示词: ${workspace.prompts.length} 个`);
    console.log(`      - 类型: ${workspace.isGlobal ? '全局' : '项目'}`);
  });

  console.log('\n🎉 MCP 工作空间功能示例完成！');
}

/**
 * 如果直接运行此文件则执行示例
 */
if (require.main === module) {
  runMCPWorkspaceExample().catch(console.error);
}
