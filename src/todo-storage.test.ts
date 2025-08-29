/**
 * 🔴 TDD 红阶段：TODO 存储功能测试
 * 先编写失败测试，确保测试驱动开发流程
 */

import { TodoStorage } from './todo-storage';
import path from 'path';
import os from 'os';

describe('TodoStorage', () => {
  let todoStorage: TodoStorage;
  const testDbPath = path.join(os.tmpdir(), `todo-test-${Date.now()}-${Math.random()}`);

  beforeEach(async () => {
    todoStorage = new TodoStorage({ dbPath: testDbPath });
    await todoStorage.initialize();
    await todoStorage.clear();
  });

  afterEach(async () => {
    if (todoStorage) {
      await todoStorage.close();
    }
  });

  describe('基础功能测试', () => {
    it('应该能够创建TODO存储实例', () => {
      expect(todoStorage).toBeDefined();
    });

    it('应该能够添加一个新的TODO项目', async () => {
      const todoId = await todoStorage.addTodo('完成项目文档');
      expect(todoId).toBeDefined();
      expect(typeof todoId).toBe('string');
    });

    it('应该能够获取TODO项目详情', async () => {
      const todoId = await todoStorage.addTodo('编写单元测试');
      const todo = await todoStorage.getTodo(todoId);
      
      expect(todo).toBeDefined();
      expect(todo?.title).toBe('编写单元测试');
      expect(todo?.completed).toBe(false);
      expect(todo?.id).toBe(todoId);
    });

    it('应该能够列出所有TODO项目', async () => {
      await todoStorage.addTodo('任务1');
      await todoStorage.addTodo('任务2');
      
      const todos = await todoStorage.listTodos();
      expect(todos).toHaveLength(2);
      
      // 验证所有任务都存在，不依赖特定顺序
      const titles = todos.map(todo => todo.title);
      expect(titles).toContain('任务1');
      expect(titles).toContain('任务2');
    });

    it('应该能够标记TODO为已完成', async () => {
      const todoId = await todoStorage.addTodo('需要完成的任务');
      await todoStorage.completeTodo(todoId);
      
      const todo = await todoStorage.getTodo(todoId);
      expect(todo?.completed).toBe(true);
    });
  });

  describe('数据持久化测试', () => {
    it('应该能够删除TODO项目', async () => {
      const todoId = await todoStorage.addTodo('待删除的任务');
      await todoStorage.deleteTodo(todoId);
      
      const todo = await todoStorage.getTodo(todoId);
      expect(todo).toBeNull();
    });

    it('应该能够清空所有TODO项目', async () => {
      await todoStorage.addTodo('任务1');
      await todoStorage.addTodo('任务2');
      
      await todoStorage.clear();
      
      const todos = await todoStorage.listTodos();
      expect(todos).toHaveLength(0);
    });
  });
});