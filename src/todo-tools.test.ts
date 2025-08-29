/**
 * 🔴 TDD 红阶段：TODO工具失败测试
 * 遵循严格TDD流程，先写失败测试
 */

import { TodoToolsProvider } from './todo-tools';
import { MCPTool } from './mcp-server';
import path from 'path';
import os from 'os';

describe('TodoToolsProvider', () => {
  let todoToolsProvider: TodoToolsProvider;
  const testDbPath = path.join(os.tmpdir(), 'todo-tools-test');

  beforeEach(() => {
    // 🔴 这里会失败 - TodoToolsProvider类还不存在
    todoToolsProvider = new TodoToolsProvider({
      dbPath: testDbPath
    });
  });

  afterEach(async () => {
    // 清理测试数据
    if (todoToolsProvider) {
      await todoToolsProvider['todoStorage']?.close();
    }
  });

  describe('getTools方法', () => {
    it('应该返回所有TODO相关工具', () => {
      const tools = todoToolsProvider.getTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // 验证工具名称
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('add_todo');
      expect(toolNames).toContain('list_todos');
      expect(toolNames).toContain('get_todo');
      expect(toolNames).toContain('update_todo');
      expect(toolNames).toContain('delete_todo');
      expect(toolNames).toContain('complete_todo');
      expect(toolNames).toContain('query_todos');
      expect(toolNames).toContain('todo_stats');
      expect(toolNames).toContain('clear_todos');
    });

    it('每个工具应该有正确的结构', () => {
      const tools = todoToolsProvider.getTools();
      
      tools.forEach((tool: MCPTool) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('handler');
        expect(tool).toHaveProperty('schema');
        expect(typeof tool.handler).toBe('function');
      });
    });
  });

  describe('添加TODO工具', () => {
    it('应该成功添加新的TODO项目', async () => {
      const tools = todoToolsProvider.getTools();
      const addTodoTool = tools.find(tool => tool.name === 'add_todo');
      
      expect(addTodoTool).toBeDefined();
      
      if (addTodoTool) {
        const result = await addTodoTool.handler({
          title: '测试任务',
          description: '这是一个测试任务',
          priority: 'high'
        });
        
        expect(result.success).toBe(true);
        expect(result.id).toBeDefined();
        expect(result.title).toBe('测试任务');
      }
    });

    it('应该处理添加TODO时的错误情况', async () => {
      const tools = todoToolsProvider.getTools();
      const addTodoTool = tools.find(tool => tool.name === 'add_todo');
      
      if (addTodoTool) {
        const result = await addTodoTool.handler({
          // 缺少必需的title参数
          description: '没有标题的任务'
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('列出TODO工具', () => {
    it('应该返回所有TODO项目列表', async () => {
      const tools = todoToolsProvider.getTools();
      const listTodosTool = tools.find(tool => tool.name === 'list_todos');
      
      expect(listTodosTool).toBeDefined();
      
      if (listTodosTool) {
        const result = await listTodosTool.handler({});
        
        expect(result.success).toBe(true);
        expect(Array.isArray(result.todos)).toBe(true);
      }
    });
  });

  describe('获取TODO工具', () => {
    it('应该根据ID获取特定TODO项目', async () => {
      const tools = todoToolsProvider.getTools();
      const getTodoTool = tools.find(tool => tool.name === 'get_todo');
      
      expect(getTodoTool).toBeDefined();
      
      if (getTodoTool) {
        // 先添加一个TODO
        const addTodoTool = tools.find(tool => tool.name === 'add_todo');
        if (addTodoTool) {
          const addResult = await addTodoTool.handler({
            title: '待获取的任务'
          });
          
          expect(addResult.success).toBe(true);
          
          // 然后获取它
          const getResult = await getTodoTool.handler({
            id: addResult.id
          });
          
          expect(getResult.success).toBe(true);
          expect(getResult.todo.title).toBe('待获取的任务');
        }
      }
    });

    it('应该处理获取不存在TODO的情况', async () => {
      const tools = todoToolsProvider.getTools();
      const getTodoTool = tools.find(tool => tool.name === 'get_todo');
      
      if (getTodoTool) {
        const result = await getTodoTool.handler({
          id: 'nonexistent-id'
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('完成TODO工具', () => {
    it('应该标记TODO为已完成', async () => {
      const tools = todoToolsProvider.getTools();
      const completeTodoTool = tools.find(tool => tool.name === 'complete_todo');
      const addTodoTool = tools.find(tool => tool.name === 'add_todo');
      
      expect(completeTodoTool).toBeDefined();
      
      if (completeTodoTool && addTodoTool) {
        // 先添加一个TODO
        const addResult = await addTodoTool.handler({
          title: '待完成的任务'
        });
        
        // 然后标记为完成
        const completeResult = await completeTodoTool.handler({
          id: addResult.id
        });
        
        expect(completeResult.success).toBe(true);
        expect(completeResult.message).toContain('已完成');
      }
    });
  });

  describe('更新TODO工具', () => {
    it('应该成功更新TODO项目', async () => {
      const tools = todoToolsProvider.getTools();
      const updateTodoTool = tools.find(tool => tool.name === 'update_todo');
      const addTodoTool = tools.find(tool => tool.name === 'add_todo');
      
      if (updateTodoTool && addTodoTool) {
        // 先添加一个TODO
        const addResult = await addTodoTool.handler({
          title: '原始任务'
        });
        
        // 然后更新它
        const updateResult = await updateTodoTool.handler({
          id: addResult.id,
          title: '更新后的任务',
          priority: 'high'
        });
        
        expect(updateResult.success).toBe(true);
      }
    });
  });

  describe('删除TODO工具', () => {
    it('应该成功删除TODO项目', async () => {
      const tools = todoToolsProvider.getTools();
      const deleteTodoTool = tools.find(tool => tool.name === 'delete_todo');
      const addTodoTool = tools.find(tool => tool.name === 'add_todo');
      
      if (deleteTodoTool && addTodoTool) {
        // 先添加一个TODO
        const addResult = await addTodoTool.handler({
          title: '待删除的任务'
        });
        
        // 然后删除它
        const deleteResult = await deleteTodoTool.handler({
          id: addResult.id
        });
        
        expect(deleteResult.success).toBe(true);
        expect(deleteResult.message).toContain('删除成功');
      }
    });
  });

  describe('查询TODO工具', () => {
    it('应该根据条件查询TODO项目', async () => {
      const tools = todoToolsProvider.getTools();
      const queryTodosTool = tools.find(tool => tool.name === 'query_todos');
      
      expect(queryTodosTool).toBeDefined();
      
      if (queryTodosTool) {
        const result = await queryTodosTool.handler({
          completed: false,
          priority: 'high'
        });
        
        expect(result.success).toBe(true);
        expect(Array.isArray(result.todos)).toBe(true);
      }
    });
  });

  describe('TODO统计工具', () => {
    it('应该返回TODO统计信息', async () => {
      const tools = todoToolsProvider.getTools();
      const todoStatsTool = tools.find(tool => tool.name === 'todo_stats');
      
      expect(todoStatsTool).toBeDefined();
      
      if (todoStatsTool) {
        const result = await todoStatsTool.handler({});
        
        expect(result.success).toBe(true);
        expect(result.stats).toBeDefined();
        expect(result.stats.total).toBeGreaterThanOrEqual(0);
        expect(result.stats.completed).toBeGreaterThanOrEqual(0);
        expect(result.stats.pending).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('清空TODO工具', () => {
    it('应该清空所有TODO项目', async () => {
      const tools = todoToolsProvider.getTools();
      const clearTodosTool = tools.find(tool => tool.name === 'clear_todos');
      
      expect(clearTodosTool).toBeDefined();
      
      if (clearTodosTool) {
        const result = await clearTodosTool.handler({});
        
        expect(result.success).toBe(true);
        expect(result.message).toContain('清空成功');
      }
    });
  });
});