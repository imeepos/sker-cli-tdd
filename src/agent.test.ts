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
      isConnected: jest.fn().mockReturnValue(true)
    };

    agent = new MQAgent(); // ❌ 这会失败 - 正确的！
  });

  describe('初始化和配置', () => {
    it('应该能够创建MQAgent实例', () => {
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(MQAgent);
    });

    it('应该能够从MQ_URL环境变量加载配置', () => {
      process.env['MQ_URL'] = 'amqp://testuser:testpass@testhost:5673';
      process.env['MQ_TASK_QUEUE'] = 'task_queue';
      process.env['MQ_RESULT_QUEUE'] = 'result_queue';
      process.env['AGENT_ID'] = 'test-agent-001';

      const config = agent.loadConfig();

      expect(config.url).toBe('amqp://testuser:testpass@testhost:5673');
      expect(config.host).toBe('testhost');
      expect(config.port).toBe(5673);
      expect(config.username).toBe('testuser');
      expect(config.password).toBe('testpass');
      expect(config.taskQueue).toBe('task_queue');
      expect(config.resultQueue).toBe('result_queue');
      expect(config.agentId).toBe('test-agent-001');
    });

    it('应该能够从分离的环境变量加载配置', () => {
      delete process.env['MQ_URL'];
      process.env['MQ_HOST'] = 'localhost';
      process.env['MQ_PORT'] = '5672';
      process.env['MQ_USERNAME'] = 'guest';
      process.env['MQ_PASSWORD'] = 'guest';
      process.env['MQ_TASK_QUEUE'] = 'task_queue';
      process.env['MQ_RESULT_QUEUE'] = 'result_queue';
      process.env['AGENT_ID'] = 'test-agent-001';

      const config = agent.loadConfig();

      expect(config.url).toBe('amqp://guest:guest@localhost:5672');
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5672);
      expect(config.username).toBe('guest');
      expect(config.password).toBe('guest');
      expect(config.taskQueue).toBe('task_queue');
      expect(config.resultQueue).toBe('result_queue');
      expect(config.agentId).toBe('test-agent-001');
    });

    it('应该能够设置默认配置', () => {
      delete process.env['MQ_URL'];
      delete process.env['MQ_HOST'];
      delete process.env['MQ_PORT'];
      delete process.env['AGENT_ID'];

      const config = agent.loadConfig();

      expect(config.url).toBe('amqp://guest:guest@localhost:5672');
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5672);
      expect(config.agentId).toMatch(/^agent-/);
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
          command: 'echo "Hello World"'
        },
        timestamp: new Date().toISOString()
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
        timestamp: new Date().toISOString()
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

  describe('工具执行', () => {
    it('应该能够执行命令工具', async () => {
      const taskMessage: TaskMessage = {
        id: 'task-001',
        from: 'client-001',
        to: 'agent-001',
        type: 'execute_command',
        payload: { command: 'echo "test"' },
        timestamp: new Date().toISOString()
      };

      const result = await agent.executeTask(taskMessage); // ❌ 这会失败 - 正确的！
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.taskId).toBe('task-001');
    });

    it('应该能够执行文件操作工具', async () => {
      const taskMessage: TaskMessage = {
        id: 'task-002',
        from: 'client-001',
        to: 'agent-001',
        type: 'read_file',
        payload: { path: 'package.json' },
        timestamp: new Date().toISOString()
      };

      const result = await agent.executeTask(taskMessage); // ❌ 这会失败 - 正确的！
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.taskId).toBe('task-002');
    });

    it('应该能够处理工具执行错误', async () => {
      const taskMessage: TaskMessage = {
        id: 'task-003',
        from: 'client-001',
        to: 'agent-001',
        type: 'invalid_tool',
        payload: {},
        timestamp: new Date().toISOString()
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
        timestamp: new Date().toISOString()
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
        timestamp: new Date().toISOString()
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
        timestamp: new Date().toISOString()
      };

      // 处理任务
      const result = await agent.processTask(taskMessage); // ❌ 这会失败 - 正确的！
      
      expect(result).toBe(true);
      expect(mockMQConnection.publish).toHaveBeenCalled();
    });
  });
});
