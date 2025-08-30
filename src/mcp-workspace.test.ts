/**
 * 🔴 TDD 红阶段：MCP 工作空间功能测试
 * 这些测试最初会失败 - 这是正确的 TDD 行为！
 */

import { MCPServer } from './mcp-server';
import { MCPWorkspace, MCPWorkspaceManager } from './mcp-workspace';

describe('MCP 工作空间功能', () => {
  describe('工作空间接口定义', () => {
    it('应该定义 MCPWorkspace 接口', () => {
      const workspace: MCPWorkspace = {
        // ❌ 会失败 - 接口不存在
        id: 'test-workspace',
        name: '测试工作空间',
        description: '用于测试的工作空间',
        isGlobal: false,
        tools: [],
        resources: [],
        prompts: [],
      };

      expect(workspace.id).toBe('test-workspace');
      expect(workspace.name).toBe('测试工作空间');
      expect(workspace.isGlobal).toBe(false);
    });
  });

  describe('工作空间管理器', () => {
    let workspaceManager: MCPWorkspaceManager;

    beforeEach(() => {
      workspaceManager = new MCPWorkspaceManager(); // ❌ 会失败 - 类不存在
    });

    it('应该创建工作空间管理器实例', () => {
      expect(workspaceManager).toBeInstanceOf(MCPWorkspaceManager);
    });

    it('应该有默认的全局工作空间', () => {
      const globalWorkspace = workspaceManager.getGlobalWorkspace(); // ❌ 会失败
      expect(globalWorkspace).toBeDefined();
      expect(globalWorkspace.isGlobal).toBe(true);
      expect(globalWorkspace.id).toBe('global');
      expect(globalWorkspace.name).toBe('全局工作空间');
    });

    it('应该创建新的工作空间', () => {
      const workspace = workspaceManager.createWorkspace({
        // ❌ 会失败
        id: 'project-a',
        name: '项目 A',
        description: '项目 A 的工作空间',
      });

      expect(workspace.id).toBe('project-a');
      expect(workspace.name).toBe('项目 A');
      expect(workspace.isGlobal).toBe(false);
    });

    it('应该获取所有工作空间', () => {
      workspaceManager.createWorkspace({
        id: 'workspace1',
        name: '工作空间1',
      });

      workspaceManager.createWorkspace({
        id: 'workspace2',
        name: '工作空间2',
      });

      const workspaces = workspaceManager.getAllWorkspaces(); // ❌ 会失败
      expect(workspaces).toHaveLength(3); // 包括全局工作空间
      expect(workspaces.some((w: MCPWorkspace) => w.id === 'global')).toBe(
        true
      );
      expect(workspaces.some((w: MCPWorkspace) => w.id === 'workspace1')).toBe(
        true
      );
      expect(workspaces.some((w: MCPWorkspace) => w.id === 'workspace2')).toBe(
        true
      );
    });

    it('应该按 ID 获取工作空间', () => {
      const created = workspaceManager.createWorkspace({
        id: 'test-workspace',
        name: '测试工作空间',
      });

      const found = workspaceManager.getWorkspace('test-workspace'); // ❌ 会失败
      expect(found).toEqual(created);
    });

    it('应该在工作空间不存在时返回 undefined', () => {
      const found = workspaceManager.getWorkspace('nonexistent');
      expect(found).toBeUndefined();
    });

    it('应该防止重复创建同 ID 的工作空间', () => {
      workspaceManager.createWorkspace({
        id: 'duplicate',
        name: '第一个',
      });

      expect(() =>
        workspaceManager.createWorkspace({
          id: 'duplicate',
          name: '第二个',
        })
      ).toThrow('工作空间 "duplicate" 已存在');
    });

    it('应该删除工作空间', () => {
      workspaceManager.createWorkspace({
        id: 'to-delete',
        name: '待删除的工作空间',
      });

      const deleted = workspaceManager.deleteWorkspace('to-delete'); // ❌ 会失败
      expect(deleted).toBe(true);
      expect(workspaceManager.getWorkspace('to-delete')).toBeUndefined();
    });

    it('应该防止删除全局工作空间', () => {
      expect(() => workspaceManager.deleteWorkspace('global')).toThrow(
        '不能删除全局工作空间'
      );
    });
  });

  describe('工作空间资源管理', () => {
    let workspaceManager: MCPWorkspaceManager;

    beforeEach(() => {
      workspaceManager = new MCPWorkspaceManager();
    });

    it('应该向工作空间添加工具', () => {
      const workspace = workspaceManager.createWorkspace({
        id: 'test-workspace',
        name: '测试工作空间',
      });

      const tool = {
        name: 'test-tool',
        description: '测试工具',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => ({ result: 'test' }),
      };

      workspaceManager.addToolToWorkspace('test-workspace', tool); // ❌ 会失败
      expect(workspace.tools).toContain(tool);
    });

    it('应该向工作空间添加资源', () => {
      const workspace = workspaceManager.createWorkspace({
        id: 'test-workspace',
        name: '测试工作空间',
      });

      const resource = {
        uri: 'file://test.txt',
        name: '测试文件',
        mimeType: 'text/plain',
        description: '测试资源',
      };

      workspaceManager.addResourceToWorkspace('test-workspace', resource); // ❌ 会失败
      expect(workspace.resources).toContain(resource);
    });

    it('应该向工作空间添加提示词', () => {
      const workspace = workspaceManager.createWorkspace({
        id: 'test-workspace',
        name: '测试工作空间',
      });

      const prompt = {
        name: 'test-prompt',
        description: '测试提示词',
        template: '你好，{{name}}！',
        arguments: [{ name: 'name', description: '名称', required: true }],
      };

      workspaceManager.addPromptToWorkspace('test-workspace', prompt); // ❌ 会失败
      expect(workspace.prompts).toContain(prompt);
    });

    it('应该从工作空间移除资源', () => {
      const workspace = workspaceManager.createWorkspace({
        id: 'test-workspace',
        name: '测试工作空间',
      });

      const tool = {
        name: 'test-tool',
        description: '测试工具',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => ({ result: 'test' }),
      };

      workspaceManager.addToolToWorkspace('test-workspace', tool);
      expect(workspace.tools).toContain(tool);

      workspaceManager.removeToolFromWorkspace('test-workspace', 'test-tool'); // ❌ 会失败
      expect(workspace.tools).not.toContain(tool);
    });
  });

  describe('与 MCP 服务器集成', () => {
    let server: MCPServer;
    let workspaceManager: MCPWorkspaceManager;

    beforeEach(() => {
      server = new MCPServer();
      workspaceManager = new MCPWorkspaceManager();
    });

    it('应该将工作空间管理器集成到 MCP 服务器', () => {
      server.setWorkspaceManager(workspaceManager); // ❌ 会失败 - 方法不存在
      expect(server.getWorkspaceManager()).toBe(workspaceManager);
    });

    it('应该设置当前工作空间', () => {
      const workspace = workspaceManager.createWorkspace({
        id: 'current-workspace',
        name: '当前工作空间',
      });

      server.setWorkspaceManager(workspaceManager);
      server.setCurrentWorkspace('current-workspace'); // ❌ 会失败
      expect(server.getCurrentWorkspace()).toEqual(workspace);
    });

    it('应该获取合并后的工具列表（全局 + 当前工作空间）', () => {
      // 设置工作空间管理器
      server.setWorkspaceManager(workspaceManager);

      // 添加全局工具
      const globalTool = {
        name: 'global-tool',
        description: '全局工具',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => ({ result: 'global' }),
      };
      workspaceManager.addToolToWorkspace('global', globalTool);

      // 创建工作空间并添加工具
      workspaceManager.createWorkspace({
        id: 'test-workspace',
        name: '测试工作空间',
      });
      const workspaceTool = {
        name: 'workspace-tool',
        description: '工作空间工具',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => ({ result: 'workspace' }),
      };
      workspaceManager.addToolToWorkspace('test-workspace', workspaceTool);

      // 设置当前工作空间
      server.setCurrentWorkspace('test-workspace');

      // 获取合并后的工具列表
      const allTools = server.getTools(); // 应该包含全局和工作空间的工具
      expect(allTools).toHaveLength(2);
      expect(allTools.some(t => t.name === 'global-tool')).toBe(true);
      expect(allTools.some(t => t.name === 'workspace-tool')).toBe(true);
    });

    it('应该在没有工作空间管理器时抛出错误', () => {
      expect(() => server.setCurrentWorkspace('test')).toThrow(
        '工作空间管理器未设置'
      );
    });

    it('应该支持工作空间级别的工具执行', async () => {
      server.setWorkspaceManager(workspaceManager);

      // 创建工作空间并添加工具
      workspaceManager.createWorkspace({
        id: 'test-workspace',
        name: '测试工作空间',
      });

      const tool = {
        name: 'workspace-tool',
        description: '工作空间工具',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => ({ result: 'workspace-result' }),
      };
      workspaceManager.addToolToWorkspace('test-workspace', tool);

      // 设置当前工作空间
      server.setCurrentWorkspace('test-workspace');

      // 执行工具
      const result = await server.executeTool('workspace-tool', {});
      expect(result).toEqual({ result: 'workspace-result' });
    });
  });
});
