/**
 * 🟢 TDD 绿阶段：TODO工具提供者最小实现
 * 封装TODO存储为MCP工具，集成到CLI工具中
 */

import { MCPTool } from './mcp-server';
import { ToolProvider } from './tool-manager';
import { TodoStorage, TodoQueryOptions } from './todo-storage';
import { DatabaseConfig } from './database-service';

/**
 * TODO工具提供者
 * 将TODO存储功能封装为MCP工具集合
 */
export class TodoToolsProvider implements ToolProvider {
  private readonly todoStorage: TodoStorage;

  constructor(config?: DatabaseConfig) {
    this.todoStorage = new TodoStorage(config);
  }

  /**
   * 获取所有TODO工具
   */
  getTools(): MCPTool[] {
    return [
      this.getAddTodoTool(),
      this.getListTodosTool(),
      this.getGetTodoTool(),
      this.getUpdateTodoTool(),
      this.getDeleteTodoTool(),
      this.getCompleteTodoTool(),
      this.getQueryTodosTool(),
      this.getTodoStatsTool(),
      this.getClearTodosTool()
    ];
  }

  /**
   * 添加TODO工具
   */
  private getAddTodoTool(): MCPTool {
    return {
      name: 'add_todo',
      description: '添加新的TODO项目',
      handler: async (params: {
        title?: string;
        description?: string;
        priority?: 'low' | 'medium' | 'high';
        tags?: string[];
        dueDate?: number;
      }) => {
        try {
          if (!params.title) {
            return {
              success: false,
              error: '标题不能为空'
            };
          }

          await this.todoStorage.initialize();
          const todoId = await this.todoStorage.addTodo(params.title, {
            description: params.description,
            priority: params.priority,
            tags: params.tags,
            dueDate: params.dueDate
          });

          return {
            success: true,
            id: todoId,
            title: params.title,
            message: 'TODO项目添加成功'
          };
        } catch (error) {
          return {
            success: false,
            error: `添加TODO失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'TODO标题' },
          description: { type: 'string', description: 'TODO描述' },
          priority: { 
            type: 'string', 
            enum: ['low', 'medium', 'high'],
            description: '优先级' 
          },
          tags: { 
            type: 'array',
            items: { type: 'string' },
            description: '标签数组' 
          },
          dueDate: { type: 'number', description: '截止时间戳' }
        },
        required: ['title']
      }
    };
  }

  /**
   * 列出TODO工具
   */
  private getListTodosTool(): MCPTool {
    return {
      name: 'list_todos',
      description: '列出所有TODO项目',
      handler: async () => {
        try {
          await this.todoStorage.initialize();
          const todos = await this.todoStorage.listTodos();
          
          return {
            success: true,
            todos: todos,
            count: todos.length
          };
        } catch (error) {
          return {
            success: false,
            error: `获取TODO列表失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  /**
   * 获取TODO工具
   */
  private getGetTodoTool(): MCPTool {
    return {
      name: 'get_todo',
      description: '根据ID获取特定TODO项目',
      handler: async (params: { id: string }) => {
        try {
          await this.todoStorage.initialize();
          const todo = await this.todoStorage.getTodo(params.id);
          
          if (!todo) {
            return {
              success: false,
              error: `未找到ID为 ${params.id} 的TODO项目`
            };
          }

          return {
            success: true,
            todo: todo
          };
        } catch (error) {
          return {
            success: false,
            error: `获取TODO失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'TODO项目ID' }
        },
        required: ['id']
      }
    };
  }

  /**
   * 更新TODO工具
   */
  private getUpdateTodoTool(): MCPTool {
    return {
      name: 'update_todo',
      description: '更新TODO项目',
      handler: async (params: {
        id: string;
        title?: string;
        description?: string;
        priority?: 'low' | 'medium' | 'high';
        tags?: string[];
        dueDate?: number;
        completed?: boolean;
      }) => {
        try {
          await this.todoStorage.initialize();
          const success = await this.todoStorage.updateTodo(params.id, {
            title: params.title,
            description: params.description,
            priority: params.priority,
            tags: params.tags,
            dueDate: params.dueDate,
            completed: params.completed
          });

          if (!success) {
            return {
              success: false,
              error: `未找到ID为 ${params.id} 的TODO项目`
            };
          }

          return {
            success: true,
            id: params.id,
            message: 'TODO项目更新成功'
          };
        } catch (error) {
          return {
            success: false,
            error: `更新TODO失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'TODO项目ID' },
          title: { type: 'string', description: 'TODO标题' },
          description: { type: 'string', description: 'TODO描述' },
          priority: { 
            type: 'string', 
            enum: ['low', 'medium', 'high'],
            description: '优先级' 
          },
          tags: { 
            type: 'array',
            items: { type: 'string' },
            description: '标签数组' 
          },
          dueDate: { type: 'number', description: '截止时间戳' },
          completed: { type: 'boolean', description: '是否完成' }
        },
        required: ['id']
      }
    };
  }

  /**
   * 删除TODO工具
   */
  private getDeleteTodoTool(): MCPTool {
    return {
      name: 'delete_todo',
      description: '删除TODO项目',
      handler: async (params: { id: string }) => {
        try {
          await this.todoStorage.initialize();
          await this.todoStorage.deleteTodo(params.id);
          
          return {
            success: true,
            id: params.id,
            message: 'TODO项目删除成功'
          };
        } catch (error) {
          return {
            success: false,
            error: `删除TODO失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'TODO项目ID' }
        },
        required: ['id']
      }
    };
  }

  /**
   * 完成TODO工具
   */
  private getCompleteTodoTool(): MCPTool {
    return {
      name: 'complete_todo',
      description: '标记TODO项目为已完成',
      handler: async (params: { id: string }) => {
        try {
          await this.todoStorage.initialize();
          await this.todoStorage.completeTodo(params.id);
          
          return {
            success: true,
            id: params.id,
            message: 'TODO项目已完成'
          };
        } catch (error) {
          return {
            success: false,
            error: `完成TODO失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'TODO项目ID' }
        },
        required: ['id']
      }
    };
  }

  /**
   * 查询TODO工具
   */
  private getQueryTodosTool(): MCPTool {
    return {
      name: 'query_todos',
      description: '根据条件查询TODO项目',
      handler: async (params: TodoQueryOptions) => {
        try {
          await this.todoStorage.initialize();
          const todos = await this.todoStorage.queryTodos(params);
          
          return {
            success: true,
            todos: todos,
            count: todos.length,
            query: params
          };
        } catch (error) {
          return {
            success: false,
            error: `查询TODO失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          completed: { type: 'boolean', description: '完成状态' },
          priority: { 
            type: 'string', 
            enum: ['low', 'medium', 'high'],
            description: '优先级' 
          },
          tags: { 
            type: 'array',
            items: { type: 'string' },
            description: '标签数组' 
          },
          startDate: { type: 'number', description: '开始时间戳' },
          endDate: { type: 'number', description: '结束时间戳' },
          limit: { type: 'number', description: '限制数量' },
          offset: { type: 'number', description: '偏移量' }
        },
        required: []
      }
    };
  }

  /**
   * TODO统计工具
   */
  private getTodoStatsTool(): MCPTool {
    return {
      name: 'todo_stats',
      description: '获取TODO统计信息',
      handler: async () => {
        try {
          await this.todoStorage.initialize();
          const stats = await this.todoStorage.getTodoStats();
          
          return {
            success: true,
            stats: stats
          };
        } catch (error) {
          return {
            success: false,
            error: `获取统计信息失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  /**
   * 清空TODO工具
   */
  private getClearTodosTool(): MCPTool {
    return {
      name: 'clear_todos',
      description: '清空所有TODO项目',
      handler: async () => {
        try {
          await this.todoStorage.initialize();
          await this.todoStorage.clear();
          
          return {
            success: true,
            message: 'TODO项目清空成功'
          };
        } catch (error) {
          return {
            success: false,
            error: `清空TODO失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    await this.todoStorage.close();
  }
}