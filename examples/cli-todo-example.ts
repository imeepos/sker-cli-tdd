/**
 * CLI TODO工具集成示例
 * 展示如何通过MCP工具使用TODO功能
 */

import { TodoToolsProvider } from '../src/todo-tools';
import { ToolManager } from '../src/tool-manager';
import { MCPServer } from '../src/mcp-server';
import { MCPWorkspaceManager } from '../src/mcp-workspace';
import path from 'path';
import os from 'os';

async function cliTodoExample() {
  console.log('🚀 启动 CLI TODO 工具集成示例...\n');

  // 创建MCP组件
  const mcpServer = new MCPServer();
  const workspaceManager = new MCPWorkspaceManager();
  const toolManager = new ToolManager(mcpServer, workspaceManager);

  // 创建TODO工具提供者
  const todoToolsProvider = new TodoToolsProvider({
    dbPath: path.join(os.tmpdir(), 'cli-todo-example')
  });

  try {
    // 注册TODO工具
    toolManager.registerToolProvider(todoToolsProvider);
    console.log('✅ TODO工具已注册到CLI系统\n');

    // 获取可用工具
    const availableTools = toolManager.getAvailableTools();
    const todoTools = availableTools.filter(tool => tool.name.includes('todo'));
    
    console.log('📋 可用的TODO工具：');
    todoTools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name} - ${tool.description}`);
    });
    console.log('');

    // 模拟通过CLI使用TODO工具
    console.log('🛠️  模拟CLI工具调用...\n');

    // 1. 添加TODO项目
    console.log('1️⃣ 添加TODO项目：');
    const addTool = toolManager.findTool('add_todo');
    if (addTool) {
      const result1 = await addTool.handler({
        title: '完成CLI TODO工具集成',
        description: '将TODO存储功能集成到CLI工具中',
        priority: 'high',
        tags: ['CLI', '工具', '集成']
      });
      console.log(`   结果: ${result1.success ? '✅ 成功' : '❌ 失败'}`);
      console.log(`   ID: ${result1.id}`);
      console.log('');

      // 2. 添加更多TODO
      const result2 = await addTool.handler({
        title: '编写用户文档',
        description: '为TODO工具编写详细的使用文档',
        priority: 'medium',
        tags: ['文档', '用户指南']
      });

      const result3 = await addTool.handler({
        title: '优化性能',
        description: '优化数据库查询和工具执行性能',
        priority: 'low',
        tags: ['性能', '优化']
      });
      console.log('✅ 第三个TODO添加结果:', result3);

      // 3. 列出所有TODO
      console.log('2️⃣ 列出所有TODO项目：');
      const listTool = toolManager.findTool('list_todos');
      if (listTool) {
        const listResult = await listTool.handler({});
        if (listResult.success && listResult.todos) {
          listResult.todos.forEach((todo: any, index: number) => {
            const priorityIcon = todo.priority === 'high' ? '🔴' : 
                               todo.priority === 'medium' ? '🟡' : '🟢';
            const statusIcon = todo.completed ? '✅' : '⏳';
            console.log(`   ${index + 1}. ${statusIcon} ${priorityIcon} ${todo.title}`);
            if (todo.tags && todo.tags.length > 0) {
              console.log(`      🏷️  ${todo.tags.join(', ')}`);
            }
          });
        }
      }
      console.log('');

      // 4. 完成第一个TODO
      console.log('3️⃣ 完成第一个TODO：');
      const completeTool = toolManager.findTool('complete_todo');
      if (completeTool) {
        const completeResult = await completeTool.handler({
          id: result1.id
        });
        console.log(`   结果: ${completeResult.success ? '✅ 成功' : '❌ 失败'}`);
        console.log(`   消息: ${completeResult.message}`);
      }
      console.log('');

      // 5. 查询高优先级TODO
      console.log('4️⃣ 查询高优先级TODO：');
      const queryTool = toolManager.findTool('query_todos');
      if (queryTool) {
        const queryResult = await queryTool.handler({
          priority: 'high'
        });
        if (queryResult.success && queryResult.todos) {
          console.log(`   找到 ${queryResult.count} 个高优先级TODO：`);
          queryResult.todos.forEach((todo: any) => {
            const statusIcon = todo.completed ? '✅' : '⏳';
            console.log(`   • ${statusIcon} ${todo.title}`);
          });
        }
      }
      console.log('');

      // 6. 获取统计信息
      console.log('5️⃣ 获取TODO统计信息：');
      const statsTool = toolManager.findTool('todo_stats');
      if (statsTool) {
        const statsResult = await statsTool.handler({});
        if (statsResult.success && statsResult.stats) {
          const stats = statsResult.stats;
          console.log(`   📊 总计: ${stats.total}`);
          console.log(`   ✅ 已完成: ${stats.completed}`);
          console.log(`   ⏳ 待完成: ${stats.pending}`);
          console.log(`   优先级分布:`);
          console.log(`     🔴 高: ${stats.byPriority.high}`);
          console.log(`     🟡 中: ${stats.byPriority.medium}`);
          console.log(`     🟢 低: ${stats.byPriority.low}`);
        }
      }
      console.log('');

      // 7. 更新TODO
      console.log('6️⃣ 更新TODO项目：');
      const updateTool = toolManager.findTool('update_todo');
      if (updateTool) {
        const updateResult = await updateTool.handler({
          id: result2.id,
          title: '编写详细用户文档和API参考',
          priority: 'high',
          description: '包含安装、配置和使用示例的完整文档'
        });
        console.log(`   结果: ${updateResult.success ? '✅ 成功' : '❌ 失败'}`);
        console.log(`   消息: ${updateResult.message}`);
      }
      console.log('');

      // 8. 最终状态
      console.log('7️⃣ 最终TODO列表：');
      if (listTool) {
        const finalListResult = await listTool.handler({});
        if (finalListResult.success && finalListResult.todos) {
          finalListResult.todos.forEach((todo: any, index: number) => {
            const priorityIcon = todo.priority === 'high' ? '🔴' : 
                               todo.priority === 'medium' ? '🟡' : '🟢';
            const statusIcon = todo.completed ? '✅' : '⏳';
            console.log(`   ${index + 1}. ${statusIcon} ${priorityIcon} ${todo.title}`);
            console.log(`      📄 ${todo.description}`);
            if (todo.tags && todo.tags.length > 0) {
              console.log(`      🏷️  ${todo.tags.join(', ')}`);
            }
            console.log('');
          });
        }
      }
    }

  } catch (error) {
    console.error('❌ 发生错误:', error);
  } finally {
    // 清理资源
    await todoToolsProvider.close();
    console.log('✅ 资源已清理');
    console.log('🎉 CLI TODO 工具集成示例完成！');
  }
}

// 运行示例
if (require.main === module) {
  cliTodoExample().catch(console.error);
}

export { cliTodoExample };