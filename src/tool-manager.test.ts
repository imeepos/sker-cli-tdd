/**
 * 🔴 TDD 红阶段：工具管理器测试
 * 测试 MCP 工具调用功能集成
 */

import { ToolManager } from './tool-manager';
import { MCPServer } from './mcp-server';
import { MCPWorkspaceManager } from './mcp-workspace';

// Mock 依赖
jest.mock('./mcp-server');
jest.mock('./mcp-workspace');

describe('工具管理器', () => {
  let toolManager: ToolManager;
  let mockMCPServer: jest.Mocked<MCPServer>;
  let mockWorkspaceManager: jest.Mocked<MCPWorkspaceManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    // 创建 mock 对象
    mockMCPServer = {
      getTools: jest.fn().mockReturnValue([]),
      executeTool: jest.fn(),
      registerTool: jest.fn(),
      setWorkspaceManager: jest.fn(),
      setPromptManager: jest.fn(),
      getCurrentWorkspace: jest.fn(),
      setCurrentWorkspace: jest.fn(),
    } as any;

    mockWorkspaceManager = {
      createWorkspace: jest.fn(),
      addToolToWorkspace: jest.fn(),
      getWorkspace: jest.fn(),
      listWorkspaces: jest.fn().mockReturnValue([]),
    } as any;

    toolManager = new ToolManager(mockMCPServer, mockWorkspaceManager);
  });

  describe('初始化', () => {
    it('应该能够创建工具管理器实例', () => {
      expect(toolManager).toBeInstanceOf(ToolManager);
    });

    it('应该能够获取 MCP 服务器', () => {
      expect(toolManager.getMCPServer()).toBe(mockMCPServer);
    });

    it('应该能够获取工作空间管理器', () => {
      expect(toolManager.getWorkspaceManager()).toBe(mockWorkspaceManager);
    });
  });

  describe('工具注册', () => {
    it('应该能够注册单个工具', () => {
      const tool = {
        name: 'test-tool',
        description: '测试工具',
        schema: { type: 'object' },
        handler: jest.fn(),
      };

      toolManager.registerTool(tool);

      expect(mockMCPServer.registerTool).toHaveBeenCalledWith(tool);
    });

    it('应该能够批量注册工具', () => {
      const tools = [
        {
          name: 'tool1',
          description: '工具1',
          schema: { type: 'object' },
          handler: jest.fn(),
        },
        {
          name: 'tool2',
          description: '工具2',
          schema: { type: 'object' },
          handler: jest.fn(),
        },
      ];

      toolManager.registerTools(tools);

      expect(mockMCPServer.registerTool).toHaveBeenCalledTimes(2);
      expect(mockMCPServer.registerTool).toHaveBeenCalledWith(tools[0]);
      expect(mockMCPServer.registerTool).toHaveBeenCalledWith(tools[1]);
    });

    it('应该能够从工具提供者注册工具', () => {
      const mockProvider = {
        getTools: jest.fn().mockReturnValue([
          {
            name: 'add',
            description: '加法工具',
            schema: { type: 'object' },
            handler: jest.fn(),
          },
        ]),
      };

      toolManager.registerToolProvider(mockProvider);

      expect(mockProvider.getTools).toHaveBeenCalled();
      expect(mockMCPServer.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'add' })
      );
    });
  });

  describe('工具查询', () => {
    it('应该能够获取所有可用工具', () => {
      const mockTools = [
        { name: 'tool1', description: '工具1', schema: {}, handler: jest.fn() },
        { name: 'tool2', description: '工具2', schema: {}, handler: jest.fn() },
      ];

      mockMCPServer.getTools.mockReturnValue(mockTools);

      const tools = toolManager.getAvailableTools();

      expect(tools).toEqual(mockTools);
      expect(mockMCPServer.getTools).toHaveBeenCalled();
    });

    it('应该能够按名称查找工具', () => {
      const mockTools = [
        {
          name: 'calculator',
          description: '计算器',
          schema: {},
          handler: jest.fn(),
        },
        {
          name: 'file-reader',
          description: '文件读取器',
          schema: {},
          handler: jest.fn(),
        },
      ];

      mockMCPServer.getTools.mockReturnValue(mockTools);

      const tool = toolManager.findTool('calculator');

      expect(tool).toEqual(mockTools[0]);
    });

    it('应该在找不到工具时返回 undefined', () => {
      mockMCPServer.getTools.mockReturnValue([]);

      const tool = toolManager.findTool('non-existent');

      expect(tool).toBeUndefined();
    });

    it('应该能够按类别筛选工具', () => {
      const mockTools = [
        {
          name: 'add',
          description: '加法',
          category: 'math',
          schema: {},
          handler: jest.fn(),
        },
        {
          name: 'read-file',
          description: '读文件',
          category: 'file',
          schema: {},
          handler: jest.fn(),
        },
        {
          name: 'multiply',
          description: '乘法',
          category: 'math',
          schema: {},
          handler: jest.fn(),
        },
      ];

      mockMCPServer.getTools.mockReturnValue(mockTools);

      const mathTools = toolManager.getToolsByCategory('math');

      expect(mathTools).toHaveLength(2);
      expect(mathTools[0]?.name).toBe('add');
      expect(mathTools[1]?.name).toBe('multiply');
    });
  });

  describe('工具执行', () => {
    it('应该能够执行工具', async () => {
      const mockResult = { result: 42 };
      mockMCPServer.executeTool.mockResolvedValue(mockResult);

      const result = await toolManager.executeTool('add', { a: 20, b: 22 });

      expect(result).toEqual(mockResult);
      expect(mockMCPServer.executeTool).toHaveBeenCalledWith('add', {
        a: 20,
        b: 22,
      });
    });

    it('应该能够处理工具执行错误', async () => {
      mockMCPServer.executeTool.mockRejectedValue(new Error('工具执行失败'));

      await expect(toolManager.executeTool('invalid-tool', {})).rejects.toThrow(
        '工具执行失败'
      );
    });

    it('应该能够批量执行工具', async () => {
      const toolCalls = [
        { name: 'add', args: { a: 1, b: 2 } },
        { name: 'multiply', args: { a: 3, b: 4 } },
      ];

      mockMCPServer.executeTool
        .mockResolvedValueOnce({ result: 3 })
        .mockResolvedValueOnce({ result: 12 });

      const results = await toolManager.executeTools(toolCalls);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ result: 3 });
      expect(results[1]).toEqual({ result: 12 });
      expect(mockMCPServer.executeTool).toHaveBeenCalledTimes(2);
    });
  });

  describe('工作空间集成', () => {
    it('应该能够创建工具工作空间', () => {
      const workspace = {
        id: 'math-workspace',
        name: '数学工作空间',
        description: '数学计算工具集合',
      };

      toolManager.createToolWorkspace(workspace);

      expect(mockWorkspaceManager.createWorkspace).toHaveBeenCalledWith(
        workspace
      );
      expect(mockMCPServer.setWorkspaceManager).toHaveBeenCalledWith(
        mockWorkspaceManager
      );
    });

    it('应该能够向工作空间添加工具', () => {
      const tool = {
        name: 'calculator',
        description: '计算器',
        schema: { type: 'object' },
        handler: jest.fn(),
      };

      toolManager.addToolToWorkspace('math-workspace', tool);

      expect(mockWorkspaceManager.addToolToWorkspace).toHaveBeenCalledWith(
        'math-workspace',
        tool
      );
    });

    it('应该能够切换工作空间', () => {
      toolManager.switchWorkspace('math-workspace');

      expect(mockMCPServer.setCurrentWorkspace).toHaveBeenCalledWith(
        'math-workspace'
      );
    });

    it('应该能够获取当前工作空间', () => {
      const mockWorkspace = {
        id: 'current',
        name: '当前工作空间',
        isGlobal: false,
        tools: [],
        resources: [],
        prompts: [],
      };
      mockMCPServer.getCurrentWorkspace.mockReturnValue(mockWorkspace);

      const workspace = toolManager.getCurrentWorkspace();

      expect(workspace).toEqual(mockWorkspace);
    });
  });

  describe('工具帮助和文档', () => {
    it('应该能够获取工具帮助信息', () => {
      const mockTool = {
        name: 'calculator',
        description: '计算器工具',
        schema: {
          type: 'object',
          properties: {
            operation: { type: 'string', description: '操作类型' },
            a: { type: 'number', description: '第一个数' },
            b: { type: 'number', description: '第二个数' },
          },
        },
        handler: jest.fn(),
      };

      mockMCPServer.getTools.mockReturnValue([mockTool]);

      const help = toolManager.getToolHelp('calculator');

      expect(help).toContain('calculator');
      expect(help).toContain('计算器工具');
      expect(help).toContain('operation');
    });

    it('应该能够获取所有工具的帮助信息', () => {
      const mockTools = [
        { name: 'tool1', description: '工具1', schema: {}, handler: jest.fn() },
        { name: 'tool2', description: '工具2', schema: {}, handler: jest.fn() },
      ];

      mockMCPServer.getTools.mockReturnValue(mockTools);

      const help = toolManager.getAllToolsHelp();

      expect(help).toContain('tool1');
      expect(help).toContain('tool2');
      expect(help).toContain('可用工具');
    });
  });

  describe('工具统计', () => {
    it('应该能够获取工具使用统计', () => {
      const stats = toolManager.getToolStats();

      expect(stats).toHaveProperty('totalTools');
      expect(stats).toHaveProperty('totalExecutions');
      expect(stats).toHaveProperty('successRate');
    });

    it('应该能够重置工具统计', () => {
      toolManager.resetToolStats();

      const stats = toolManager.getToolStats();
      expect(stats.totalExecutions).toBe(0);
    });
  });
});
