/**
 * 🟢 TDD 绿阶段：TODO 存储功能最小实现
 * 基于通用数据库服务实现TODO项目的存储和管理
 */

import { DatabaseService, DatabaseConfig } from './database-service';

/**
 * TODO 项目接口
 */
export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  dueDate?: number;
}

/**
 * TODO 查询选项接口
 */
export interface TodoQueryOptions {
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

/**
 * TODO 存储类
 * 继承通用数据库服务，专门处理TODO相关操作
 */
export class TodoStorage extends DatabaseService {
  private todosDb: any;

  constructor(config: DatabaseConfig = {}) {
    // 设置默认路径和子级数据库
    const todoConfig = {
      ...config,
      dbPath:
        config.dbPath ||
        require('path').join(require('os').homedir(), '.sker-ai', 'todo-db'),
      sublevels: ['todos'],
    };

    super(todoConfig);

    this.todosDb = this.getSublevel('todos');
  }

  /**
   * 添加新的TODO项目
   */
  async addTodo(
    title: string,
    options: {
      description?: string;
      priority?: 'low' | 'medium' | 'high';
      tags?: string[];
      dueDate?: number;
    } = {}
  ): Promise<string> {
    const todoId = this.generateId('todo');
    const now = Date.now();

    const todo: TodoItem = {
      id: todoId,
      title,
      completed: false,
      createdAt: now,
      updatedAt: now,
      ...options,
    };

    await this.todosDb.put(todoId, todo);
    return todoId;
  }

  /**
   * 获取TODO项目
   */
  async getTodo(id: string): Promise<TodoItem | null> {
    try {
      const result = await this.todosDb.get(id);
      return result || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 列出所有TODO项目
   */
  async listTodos(): Promise<TodoItem[]> {
    return this.queryTodos();
  }

  /**
   * 查询TODO项目（高级查询功能）
   */
  async queryTodos(options: TodoQueryOptions = {}): Promise<TodoItem[]> {
    const {
      completed,
      priority,
      tags,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = options;

    const todos: TodoItem[] = [];

    for await (const [, todo] of this.todosDb.iterator()) {
      // 应用过滤条件
      if (completed !== undefined && todo.completed !== completed) continue;
      if (priority && todo.priority !== priority) continue;
      if (startDate && todo.createdAt < startDate) continue;
      if (endDate && todo.createdAt > endDate) continue;
      if (tags && tags.length > 0) {
        if (!todo.tags || !tags.some(tag => todo.tags!.includes(tag))) continue;
      }

      todos.push(todo);
    }

    // 按创建时间排序
    todos.sort((a, b) => a.createdAt - b.createdAt);

    // 应用分页
    return todos.slice(offset, offset + limit);
  }

  /**
   * 标记TODO为已完成
   */
  async completeTodo(id: string): Promise<void> {
    await this.updateTodo(id, { completed: true });
  }

  /**
   * 更新TODO项目
   */
  async updateTodo(
    id: string,
    updates: Partial<Omit<TodoItem, 'id' | 'createdAt'>>
  ): Promise<boolean> {
    const todo = await this.getTodo(id);
    if (!todo) return false;

    const updatedTodo: TodoItem = {
      ...todo,
      ...updates,
      updatedAt: Date.now(),
    };

    await this.todosDb.put(id, updatedTodo);
    return true;
  }

  /**
   * 删除TODO项目
   */
  async deleteTodo(id: string): Promise<void> {
    await this.todosDb.del(id);
  }

  /**
   * 清空所有TODO项目
   */
  async clear(): Promise<void> {
    await this.todosDb.clear();
  }

  /**
   * 获取TODO统计信息
   */
  async getTodoStats(): Promise<{
    total: number;
    completed: number;
    pending: number;
    byPriority: { [key: string]: number };
  }> {
    const todos = await this.listTodos();
    const stats = {
      total: todos.length,
      completed: 0,
      pending: 0,
      byPriority: { low: 0, medium: 0, high: 0 },
    };

    todos.forEach(todo => {
      if (todo.completed) {
        stats.completed++;
      } else {
        stats.pending++;
      }

      if (todo.priority) {
        stats.byPriority[todo.priority]++;
      }
    });

    return stats;
  }
}
