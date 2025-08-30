/**
 * TODO 存储工具使用示例
 * 展示如何使用基于 LevelDB 的 TODO 管理功能
 */

import { TodoStorage } from '../src/todo-storage';
import path from 'path';
import os from 'os';

async function todoExample() {
  console.log('🚀 启动 TODO 存储示例...\n');

  // 创建 TODO 存储实例
  const todoStorage = new TodoStorage({
    dbPath: path.join(os.tmpdir(), 'todo-example')
  });

  try {
    // 初始化数据库
    await todoStorage.initialize();
    console.log('✅ TODO 存储已初始化\n');

    // 清空之前的数据
    await todoStorage.clear();

    // 添加一些 TODO 项目
    console.log('📝 添加 TODO 项目...');
    const todo1 = await todoStorage.addTodo('完成项目文档', {
      description: '编写详细的项目说明文档',
      priority: 'high',
      tags: ['文档', '项目']
    });

    const todo2 = await todoStorage.addTodo('修复登录bug', {
      description: '解决用户登录时的认证问题',
      priority: 'high',
      tags: ['bug', '认证']
    });

    const todo3 = await todoStorage.addTodo('优化数据库查询', {
      description: '提升查询性能，减少响应时间',
      priority: 'medium',
      tags: ['性能', '数据库']
    });

    await todoStorage.addTodo('更新UI设计', {
      description: '根据最新设计稿更新界面',
      priority: 'low',
      tags: ['UI', '设计']
    });

    console.log(`✅ 已添加 4 个 TODO 项目\n`);

    // 列出所有 TODO
    console.log('📋 所有 TODO 项目：');
    const allTodos = await todoStorage.listTodos();
    allTodos.forEach((todo, index) => {
      const priorityIcon = todo.priority === 'high' ? '🔴' : 
                          todo.priority === 'medium' ? '🟡' : '🟢';
      const statusIcon = todo.completed ? '✅' : '⏳';
      
      console.log(`${index + 1}. ${statusIcon} ${priorityIcon} ${todo.title}`);
      if (todo.description) {
        console.log(`   📄 ${todo.description}`);
      }
      if (todo.tags && todo.tags.length > 0) {
        console.log(`   🏷️  ${todo.tags.join(', ')}`);
      }
      console.log('');
    });

    // 完成一些任务
    console.log('✅ 完成任务...');
    await todoStorage.completeTodo(todo1);
    await todoStorage.completeTodo(todo2);
    console.log(`✅ 已完成 2 个任务\n`);

    // 查询高优先级的任务
    console.log('🔍 查询高优先级任务：');
    const highPriorityTodos = await todoStorage.queryTodos({
      priority: 'high'
    });
    
    highPriorityTodos.forEach((todo) => {
      const statusIcon = todo.completed ? '✅' : '⏳';
      console.log(`• ${statusIcon} ${todo.title} (${todo.completed ? '已完成' : '待完成'})`);
    });
    console.log('');

    // 查询未完成的任务
    console.log('📝 未完成的任务：');
    const pendingTodos = await todoStorage.queryTodos({
      completed: false
    });
    
    pendingTodos.forEach((todo) => {
      const priorityIcon = todo.priority === 'high' ? '🔴' : 
                          todo.priority === 'medium' ? '🟡' : '🟢';
      console.log(`• ${priorityIcon} ${todo.title}`);
    });
    console.log('');

    // 获取统计信息
    console.log('📊 TODO 统计信息：');
    const stats = await todoStorage.getTodoStats();
    console.log(`总数: ${stats.total}`);
    console.log(`已完成: ${stats.completed}`);
    console.log(`待完成: ${stats.pending}`);
    console.log(`按优先级分布:`);
    console.log(`  🔴 高优先级: ${stats.byPriority['high']}`);
    console.log(`  🟡 中优先级: ${stats.byPriority['medium']}`);
    console.log(`  🟢 低优先级: ${stats.byPriority['low']}`);
    console.log('');

    // 更新任务
    console.log('✏️  更新任务...');
    await todoStorage.updateTodo(todo3, {
      priority: 'high',
      description: '紧急：数据库查询响应时间过长，需要立即优化'
    });
    console.log('✅ 任务已更新\n');

    // 删除任务
    console.log('🗑️  删除已完成任务...');
    await todoStorage.deleteTodo(todo1);
    console.log('✅ 任务已删除\n');

    // 最终统计
    console.log('📊 最终统计：');
    const finalStats = await todoStorage.getTodoStats();
    console.log(`剩余任务: ${finalStats.total}`);
    console.log(`已完成: ${finalStats.completed}`);
    console.log(`待完成: ${finalStats.pending}`);

  } catch (error) {
    console.error('❌ 发生错误:', error);
  } finally {
    // 关闭数据库连接
    await todoStorage.close();
    console.log('\n✅ TODO 存储已关闭');
    console.log('🎉 示例演示完成！');
  }
}

// 运行示例
if (require.main === module) {
  todoExample().catch(console.error);
}

export { todoExample };