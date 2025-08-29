/**
 * 🔄 TDD 重构阶段：Agent工具提供者测试
 * 测试MCP工具集成
 */

import { AgentToolsProvider } from './agent-tools';
import { MCPServer } from './mcp-server';

describe('AgentToolsProvider', () => {
  let provider: AgentToolsProvider;
  let server: MCPServer;

  beforeEach(() => {
    provider = new AgentToolsProvider();
    server = new MCPServer();
  });

  describe('getTools', () => {
    it('应该返回Agent工具列表', () => {
      const tools = provider.getTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(7);

      // 检查是否包含所有预期的工具
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('create_agent');
      expect(toolNames).toContain('start_agent');
      expect(toolNames).toContain('stop_agent');
      expect(toolNames).toContain('send_task');
      expect(toolNames).toContain('get_agent_status');
      expect(toolNames).toContain('list_agents');
      expect(toolNames).toContain('send_ai_task');
    });

    it('应该返回具有正确结构的工具', () => {
      const tools = provider.getTools();
      
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('handler');
        expect(tool).toHaveProperty('schema');
        expect(typeof tool.handler).toBe('function');
      });
    });
  });

  describe('create_agent工具', () => {
    it('应该能够创建新的Agent', async () => {
      // 注册工具到服务器
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      // 创建Agent
      const result = await server.executeTool('create_agent', {
        agentId: 'test-agent-001',
        mqType: 'memory'
      });
      
      expect(result.success).toBe(true);
      expect(result.agentId).toBe('test-agent-001');
      expect(result.mqType).toBe('memory');
      expect(result.config).toBeDefined();
    });

    it('应该能够创建带自动生成ID的Agent', async () => {
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });

      // 清除环境变量确保使用自动生成的ID
      delete process.env['AGENT_ID'];

      const result = await server.executeTool('create_agent', {
        mqType: 'memory'
      });

      expect(result.success).toBe(true);
      expect(result.agentId).toBeDefined();
      // Agent ID 现在从 ConfigManager 获取，不再是自动生成的格式
      expect(typeof result.agentId).toBe('string');
    });
  });

  describe('start_agent工具', () => {
    it('应该能够启动已创建的Agent', async () => {
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      // 先创建Agent
      const createResult = await server.executeTool('create_agent', {
        agentId: 'test-agent-002',
        mqType: 'memory'
      });
      expect(createResult.success).toBe(true);
      
      // 启动Agent
      const startResult = await server.executeTool('start_agent', {
        agentId: 'test-agent-002'
      });
      
      expect(startResult.success).toBe(true);
      expect(startResult.agentId).toBe('test-agent-002');
      expect(startResult.status.isConnected).toBe(true);
      expect(startResult.status.isListening).toBe(true);
    });

    it('应该能够处理启动不存在的Agent', async () => {
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      const result = await server.executeTool('start_agent', {
        agentId: 'non-existent-agent'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('不存在');
    });
  });

  describe('stop_agent工具', () => {
    it('应该能够停止运行中的Agent', async () => {
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      // 创建并启动Agent
      await server.executeTool('create_agent', {
        agentId: 'test-agent-003',
        mqType: 'memory'
      });
      await server.executeTool('start_agent', {
        agentId: 'test-agent-003'
      });
      
      // 停止Agent
      const result = await server.executeTool('stop_agent', {
        agentId: 'test-agent-003'
      });
      
      expect(result.success).toBe(true);
      expect(result.agentId).toBe('test-agent-003');
      expect(result.message).toContain('已停止');
    });
  });

  describe('send_task工具', () => {
    it('应该能够在Agent之间发送任务', async () => {
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      // 创建两个Agent
      await server.executeTool('create_agent', {
        agentId: 'sender-agent',
        mqType: 'memory'
      });
      await server.executeTool('create_agent', {
        agentId: 'receiver-agent',
        mqType: 'memory'
      });
      
      // 启动Agent
      await server.executeTool('start_agent', { agentId: 'sender-agent' });
      await server.executeTool('start_agent', { agentId: 'receiver-agent' });
      
      // 发送任务
      const result = await server.executeTool('send_task', {
        fromAgentId: 'sender-agent',
        toAgentId: 'receiver-agent',
        taskType: 'get_os_info',
        payload: {}
      });
      
      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
      expect(result.processed).toBe(true);
    });
  });

  describe('get_agent_status工具', () => {
    it('应该能够获取Agent状态', async () => {
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      // 创建并启动Agent
      await server.executeTool('create_agent', {
        agentId: 'status-test-agent',
        mqType: 'memory'
      });
      await server.executeTool('start_agent', {
        agentId: 'status-test-agent'
      });
      
      // 获取状态
      const result = await server.executeTool('get_agent_status', {
        agentId: 'status-test-agent'
      });
      
      expect(result.success).toBe(true);
      expect(result.agentId).toBe('status-test-agent');
      expect(result.status.isConnected).toBe(true);
      expect(result.status.isListening).toBe(true);
      expect(result.status.config).toBeDefined();
    });
  });

  describe('list_agents工具', () => {
    it('应该能够列出所有Agent', async () => {
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      // 创建多个Agent
      await server.executeTool('create_agent', {
        agentId: 'list-test-agent-1',
        mqType: 'memory'
      });
      await server.executeTool('create_agent', {
        agentId: 'list-test-agent-2',
        mqType: 'memory'
      });
      
      // 列出Agent
      const result = await server.executeTool('list_agents', {});
      
      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(result.agents)).toBe(true);
      
      const agentIds = result.agents.map((agent: any) => agent.agentId);
      expect(agentIds).toContain('list-test-agent-1');
      expect(agentIds).toContain('list-test-agent-2');
    });

    it('应该能够处理空Agent列表', async () => {
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      const result = await server.executeTool('list_agents', {});
      
      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(Array.isArray(result.agents)).toBe(true);
      expect(result.agents.length).toBe(0);
    });
  });

  describe('send_ai_task工具', () => {
    it('应该能够发送AI任务给Agent', async () => {
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });

      // 先创建并启动Agent
      await server.executeTool('create_agent', {
        agentId: 'ai-test-agent',
        mqType: 'memory'
      });
      await server.executeTool('start_agent', {
        agentId: 'ai-test-agent'
      });

      // 发送AI任务（禁用AI，因为测试环境没有AI配置）
      const result = await server.executeTool('send_ai_task', {
        agentId: 'ai-test-agent',
        instruction: '请帮我获取当前系统信息',
        context: '我需要了解操作系统类型',
        enableAI: false
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
    });

    it('应该能够处理不存在的Agent', async () => {
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });

      const result = await server.executeTool('send_ai_task', {
        agentId: 'non-existent-agent',
        instruction: '测试任务'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('不存在');
    });
  });

  describe('完整工作流程', () => {
    it('应该能够完成完整的Agent管理流程', async () => {
      const tools = provider.getTools();
      tools.forEach(tool => {
        server.registerTool(tool);
      });
      
      // 1. 创建Agent
      const createResult = await server.executeTool('create_agent', {
        agentId: 'workflow-test-agent',
        mqType: 'memory'
      });
      expect(createResult.success).toBe(true);
      
      // 2. 启动Agent
      const startResult = await server.executeTool('start_agent', {
        agentId: 'workflow-test-agent'
      });
      expect(startResult.success).toBe(true);
      
      // 3. 检查状态
      const statusResult = await server.executeTool('get_agent_status', {
        agentId: 'workflow-test-agent'
      });
      expect(statusResult.success).toBe(true);
      expect(statusResult.status.isConnected).toBe(true);
      
      // 4. 列出Agent
      const listResult = await server.executeTool('list_agents', {});
      expect(listResult.success).toBe(true);
      expect(listResult.count).toBeGreaterThan(0);
      
      // 5. 停止Agent
      const stopResult = await server.executeTool('stop_agent', {
        agentId: 'workflow-test-agent'
      });
      expect(stopResult.success).toBe(true);
    });
  });
});
