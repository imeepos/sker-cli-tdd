/**
 * 🔴 TDD 红阶段：MQ Agent 系统测试
 * 先写失败的测试，再实现功能
 */

import { MQAgent, TaskMessage, TaskResult } from './agent'; // ❌ 这会失败 - 正确的！

describe('MQAgent', () => {
  let agent: MQAgent;
  let mockMQConnection: any;

  beforeEach(() => {
    // Mock MQ连接
    mockMQConnection = {
      connect: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn(),
      publish: jest.fn().mockResolvedValue(true),
      isConnected: jest.fn().mockReturnValue(true),
    };

    agent = new MQAgent(); // ❌ 这会失败 - 正确的！
  });

  describe('初始化和配置', () => {
    it('应该能够创建MQAgent实例', () => {
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(MQAgent);
    });

    it('应该能够设置AI客户端', () => {
      // 模拟AI客户端
      const mockAIClient = {
        chatCompletionWithTools: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'AI处理完成', toolCalls: [] } }],
        }),
        chatCompletion: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'AI处理完成' } }],
        }),
        executeToolCall: jest.fn().mockResolvedValue({ result: 'success' }),
      };

      agent.setAIClient(mockAIClient as any);
      expect(agent.getAIClient()).toBe(mockAIClient);
    });

    it('应该能够从ConfigManager加载配置', () => {
      const config = agent.loadConfig();

      expect(config).toBeDefined();
      expect(config.url).toBeDefined();
      expect(config.host).toBeDefined();
      expect(config.port).toBeDefined();
      expect(config.username).toBeDefined();
      expect(config.password).toBeDefined();
      expect(config.taskQueue).toBeDefined();
      expect(config.resultQueue).toBeDefined();
      expect(config.agentId).toBeDefined();
    });

    it('应该能够使用自定义Agent ID', () => {
      const customId = 'custom-agent-123';
      const config = agent.loadConfig(customId);

      expect(config.agentId).toBe(customId);
    });

    it('应该能够设置默认配置', () => {
      const config = agent.loadConfig();

      expect(config.url).toBeDefined();
      expect(config.host).toBeDefined();
      expect(config.port).toBeDefined();
      expect(config.agentId).toBeDefined();
      expect(typeof config.agentId).toBe('string');
    });
  });

  describe('MQ连接管理', () => {
    it('应该能够连接到MQ服务器', async () => {
      agent.setMQConnection(mockMQConnection);

      const connected = await agent.connect(); // ❌ 这会失败 - 正确的！

      expect(connected).toBe(true);
      expect(mockMQConnection.connect).toHaveBeenCalled();
    });

    it('应该能够断开MQ连接', async () => {
      agent.setMQConnection(mockMQConnection);

      const disconnected = await agent.disconnect(); // ❌ 这会失败 - 正确的！

      expect(disconnected).toBe(true);
      expect(mockMQConnection.disconnect).toHaveBeenCalled();
    });

    it('应该能够检查连接状态', () => {
      agent.setMQConnection(mockMQConnection);

      const isConnected = agent.isConnected(); // ❌ 这会失败 - 正确的！

      expect(isConnected).toBe(true);
      expect(mockMQConnection.isConnected).toHaveBeenCalled();
    });
  });

  describe('任务消息处理', () => {
    it('应该能够解析任务消息', () => {
      const messageData = JSON.stringify({
        id: 'task-001',
        from: 'client-001',
        to: 'agent-001',
        type: 'execute_command',
        payload: {
          command: 'echo "Hello World"',
        },
        timestamp: new Date().toISOString(),
      });

      const taskMessage = agent.parseTaskMessage(messageData); // ❌ 这会失败 - 正确的！

      expect(taskMessage).toBeDefined();
      expect(taskMessage.id).toBe('task-001');
      expect(taskMessage.from).toBe('client-001');
      expect(taskMessage.to).toBe('agent-001');
      expect(taskMessage.type).toBe('execute_command');
      expect(taskMessage.payload.command).toBe('echo "Hello World"');
    });

    it('应该能够处理无效的任务消息', () => {
      const invalidMessage = 'invalid json';

      expect(() => {
        agent.parseTaskMessage(invalidMessage); // ❌ 这会失败 - 正确的！
      }).toThrow();
    });

    it('应该能够验证任务消息格式', () => {
      const validMessage: TaskMessage = {
        id: 'task-001',
        from: 'client-001',
        to: 'agent-001',
        type: 'execute_command',
        payload: { command: 'ls' },
        timestamp: new Date().toISOString(),
      };

      const isValid = agent.validateTaskMessage(validMessage); // ❌ 这会失败 - 正确的！
      expect(isValid).toBe(true);
    });

    it('应该能够拒绝无效的任务消息', () => {
      const invalidMessage = {
        id: 'task-001',
        // 缺少必需字段
      } as TaskMessage;

      const isValid = agent.validateTaskMessage(invalidMessage); // ❌ 这会失败 - 正确的！
      expect(isValid).toBe(false);
    });
  });

  describe('AI任务处理', () => {
    it('应该能够通过AI理解并执行任务', async () => {
      // 设置模拟AI客户端
      const mockAIClient = {
        chatCompletionWithTools: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: '我已经获取了系统信息：Windows 11, 版本 22H2',
                toolCalls: [],
              },
            },
          ],
        }),
        chatCompletion: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: '我已经获取了系统信息：Windows 11, 版本 22H2',
              },
            },
          ],
        }),
        executeToolCall: jest.fn().mockResolvedValue({ result: 'success' }),
      };
      agent.setAIClient(mockAIClient as any);

      const taskMessage: TaskMessage = {
        id: 'task-001',
        from: 'client-001',
        to: 'agent-001',
        type: 'ai_task',
        payload: {
          instruction: '请帮我查看当前系统信息',
          context: '我需要了解操作系统类型和版本',
        },
        timestamp: new Date().toISOString(),
      };

      const result = await agent.executeTask(taskMessage);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.taskId).toBe('task-001');
      expect(result.result).toBeDefined();
      expect(result.result.aiResponse).toContain('系统信息');
      expect(mockAIClient.chatCompletionWithTools).toHaveBeenCalled();
    });

    it('应该能够处理复杂的AI任务指令', async () => {
      // 设置模拟AI客户端
      const mockAIClient = {
        chatCompletionWithTools: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: '我需要创建文件并读取内容',
                toolCalls: [
                  {
                    id: 'call-1',
                    type: 'function',
                    function: {
                      name: 'write_file',
                      arguments: JSON.stringify({
                        path: 'hello.txt',
                        content: 'Hello World',
                      }),
                    },
                  },
                  {
                    id: 'call-2',
                    type: 'function',
                    function: {
                      name: 'read_file',
                      arguments: JSON.stringify({ path: 'hello.txt' }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        chatCompletion: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content:
                  '我已经创建了hello.txt文件，内容是"Hello World"，并成功读取了内容',
              },
            },
          ],
        }),
        executeToolCall: jest.fn().mockResolvedValue({ result: 'success' }),
      };
      agent.setAIClient(mockAIClient as any);

      const taskMessage: TaskMessage = {
        id: 'task-002',
        from: 'client-001',
        to: 'agent-001',
        type: 'ai_task',
        payload: {
          instruction:
            '请创建一个名为hello.txt的文件，内容是"Hello World"，然后读取并返回内容',
          context: '这是一个文件操作任务',
        },
        timestamp: new Date().toISOString(),
      };

      const result = await agent.executeTask(taskMessage);

      expect(result).toBeDefined();
      expect(result.taskId).toBe('task-002');
      expect(result.success).toBe(true);
      expect(result.result.toolCallsExecuted).toBe(2);
      expect(mockAIClient.chatCompletionWithTools).toHaveBeenCalled();
    });

    it('应该能够处理工具执行错误', async () => {
      const taskMessage: TaskMessage = {
        id: 'task-003',
        from: 'client-001',
        to: 'agent-001',
        type: 'invalid_tool',
        payload: {},
        timestamp: new Date().toISOString(),
      };

      const result = await agent.executeTask(taskMessage); // ❌ 这会失败 - 正确的！

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('结果发送', () => {
    it('应该能够发送任务结果', async () => {
      agent.setMQConnection(mockMQConnection);

      const taskResult: TaskResult = {
        id: 'result-001',
        taskId: 'task-001',
        from: 'agent-001',
        to: 'client-001',
        success: true,
        result: { output: 'Hello World' },
        timestamp: new Date().toISOString(),
      };

      const sent = await agent.sendResult(taskResult); // ❌ 这会失败 - 正确的！

      expect(sent).toBe(true);
      expect(mockMQConnection.publish).toHaveBeenCalled();
    });

    it('应该能够处理结果发送失败', async () => {
      mockMQConnection.publish.mockRejectedValue(new Error('Send failed'));
      agent.setMQConnection(mockMQConnection);

      const taskResult: TaskResult = {
        id: 'result-001',
        taskId: 'task-001',
        from: 'agent-001',
        to: 'client-001',
        success: true,
        result: { output: 'Hello World' },
        timestamp: new Date().toISOString(),
      };

      const sent = await agent.sendResult(taskResult); // ❌ 这会失败 - 正确的！

      expect(sent).toBe(false);
    });
  });

  describe('任务监听', () => {
    it('应该能够开始监听任务队列', async () => {
      agent.setMQConnection(mockMQConnection);

      const listening = await agent.startListening(); // ❌ 这会失败 - 正确的！

      expect(listening).toBe(true);
      expect(mockMQConnection.subscribe).toHaveBeenCalled();
    });

    it('应该能够停止监听任务队列', async () => {
      agent.setMQConnection(mockMQConnection);

      const stopped = await agent.stopListening(); // ❌ 这会失败 - 正确的！

      expect(stopped).toBe(true);
    });
  });

  describe('完整工作流程', () => {
    it('应该能够完成完整的任务处理流程', async () => {
      agent.setMQConnection(mockMQConnection);

      // 模拟接收到任务消息
      const taskMessage: TaskMessage = {
        id: 'task-001',
        from: 'client-001',
        to: 'agent-001',
        type: 'execute_command',
        payload: { command: 'echo "test"' },
        timestamp: new Date().toISOString(),
      };

      // 处理任务
      const result = await agent.processTask(taskMessage); // ❌ 这会失败 - 正确的！

      expect(result).toBe(true);
      expect(mockMQConnection.publish).toHaveBeenCalled();
    });
  });
});
