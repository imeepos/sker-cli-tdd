/**
 * 🔴 TDD 红阶段：MCP Prompt 提示词功能测试
 * 这些测试最初会失败 - 这是正确的 TDD 行为！
 */

import { MCPServer } from './mcp-server';
import { MCPPrompt, MCPPromptManager } from './mcp-prompts'; // ❌ 这会失败 - 正确的！

describe('MCP Prompt 提示词功能', () => {
  describe('Prompt 接口定义', () => {
    it('应该定义 MCPPrompt 接口', () => {
      const prompt: MCPPrompt = { // ❌ 会失败 - 接口不存在
        name: 'test-prompt',
        description: '测试提示词',
        template: '你好，{{name}}！',
        arguments: [
          {
            name: 'name',
            description: '用户名称',
            required: true
          }
        ]
      };
      
      expect(prompt.name).toBe('test-prompt');
      expect(prompt.template).toBe('你好，{{name}}！');
      expect(prompt.arguments).toHaveLength(1);
    });
  });

  describe('Prompt 管理器', () => {
    let promptManager: MCPPromptManager;

    beforeEach(() => {
      promptManager = new MCPPromptManager(); // ❌ 会失败 - 类不存在
    });

    it('应该创建 Prompt 管理器实例', () => {
      expect(promptManager).toBeInstanceOf(MCPPromptManager);
    });

    it('应该注册一个 Prompt', () => {
      const prompt: MCPPrompt = {
        name: 'greeting',
        description: '问候提示词',
        template: '你好，{{name}}！欢迎使用 {{product}}。',
        arguments: [
          {
            name: 'name',
            description: '用户名称',
            required: true
          },
          {
            name: 'product',
            description: '产品名称',
            required: false,
            default: 'MCP 服务器'
          }
        ]
      };

      promptManager.registerPrompt(prompt); // ❌ 会失败
      const prompts = promptManager.getPrompts();
      expect(prompts).toContain(prompt);
    });

    it('应该获取所有已注册的 Prompt', () => {
      const prompt1: MCPPrompt = {
        name: 'prompt1',
        description: '提示词1',
        template: '模板1',
        arguments: []
      };

      const prompt2: MCPPrompt = {
        name: 'prompt2',
        description: '提示词2',
        template: '模板2',
        arguments: []
      };

      promptManager.registerPrompt(prompt1);
      promptManager.registerPrompt(prompt2);

      const prompts = promptManager.getPrompts();
      expect(prompts).toHaveLength(2);
      expect(prompts.some(p => p.name === 'prompt1')).toBe(true);
      expect(prompts.some(p => p.name === 'prompt2')).toBe(true);
    });

    it('应该按名称获取 Prompt', () => {
      const prompt: MCPPrompt = {
        name: 'test-prompt',
        description: '测试提示词',
        template: '测试模板',
        arguments: []
      };

      promptManager.registerPrompt(prompt);
      const foundPrompt = promptManager.getPrompt('test-prompt'); // ❌ 会失败
      expect(foundPrompt).toEqual(prompt);
    });

    it('应该在 Prompt 不存在时返回 undefined', () => {
      const foundPrompt = promptManager.getPrompt('nonexistent');
      expect(foundPrompt).toBeUndefined();
    });

    it('应该防止重复注册同名 Prompt', () => {
      const prompt1: MCPPrompt = {
        name: 'duplicate',
        description: '第一个',
        template: '模板1',
        arguments: []
      };

      const prompt2: MCPPrompt = {
        name: 'duplicate',
        description: '第二个',
        template: '模板2',
        arguments: []
      };

      promptManager.registerPrompt(prompt1);
      expect(() => promptManager.registerPrompt(prompt2)) // ❌ 会失败
        .toThrow('Prompt "duplicate" 已存在');
    });
  });

  describe('Prompt 渲染', () => {
    let promptManager: MCPPromptManager;

    beforeEach(() => {
      promptManager = new MCPPromptManager();
    });

    it('应该渲染简单的 Prompt 模板', async () => {
      const prompt: MCPPrompt = {
        name: 'simple',
        description: '简单提示词',
        template: '你好，{{name}}！',
        arguments: [
          {
            name: 'name',
            description: '用户名称',
            required: true
          }
        ]
      };

      promptManager.registerPrompt(prompt);
      const result = await promptManager.renderPrompt('simple', { name: '张三' }); // ❌ 会失败
      expect(result).toBe('你好，张三！');
    });

    it('应该渲染包含默认值的 Prompt 模板', async () => {
      const prompt: MCPPrompt = {
        name: 'with-default',
        description: '带默认值的提示词',
        template: '欢迎使用 {{product}}，{{name}}！',
        arguments: [
          {
            name: 'name',
            description: '用户名称',
            required: true
          },
          {
            name: 'product',
            description: '产品名称',
            required: false,
            default: 'MCP 服务器'
          }
        ]
      };

      promptManager.registerPrompt(prompt);
      const result = await promptManager.renderPrompt('with-default', { name: '李四' });
      expect(result).toBe('欢迎使用 MCP 服务器，李四！');
    });

    it('应该验证必需参数', async () => {
      const prompt: MCPPrompt = {
        name: 'required-args',
        description: '必需参数提示词',
        template: '你好，{{name}}！',
        arguments: [
          {
            name: 'name',
            description: '用户名称',
            required: true
          }
        ]
      };

      promptManager.registerPrompt(prompt);
      await expect(promptManager.renderPrompt('required-args', {}))
        .rejects
        .toThrow('必需参数 "name" 未提供');
    });

    it('应该处理复杂的 Prompt 模板', async () => {
      const prompt: MCPPrompt = {
        name: 'complex',
        description: '复杂提示词',
        template: `你是一个 {{role}}，专门帮助用户 {{task}}。
用户信息：
- 姓名：{{name}}
- 经验等级：{{level}}

请根据以上信息提供专业的帮助。`,
        arguments: [
          {
            name: 'role',
            description: '角色',
            required: true
          },
          {
            name: 'task',
            description: '任务',
            required: true
          },
          {
            name: 'name',
            description: '用户姓名',
            required: true
          },
          {
            name: 'level',
            description: '经验等级',
            required: false,
            default: '初级'
          }
        ]
      };

      promptManager.registerPrompt(prompt);
      const result = await promptManager.renderPrompt('complex', {
        role: 'AI 助手',
        task: '学习编程',
        name: '王五'
      });

      expect(result).toContain('你是一个 AI 助手');
      expect(result).toContain('帮助用户 学习编程');
      expect(result).toContain('姓名：王五');
      expect(result).toContain('经验等级：初级');
    });
  });

  describe('与 MCP 服务器集成', () => {
    let server: MCPServer;
    let promptManager: MCPPromptManager;

    beforeEach(() => {
      server = new MCPServer();
      promptManager = new MCPPromptManager();
    });

    it('应该将 Prompt 管理器集成到 MCP 服务器', () => {
      server.setPromptManager(promptManager); // ❌ 会失败 - 方法不存在
      expect(server.getPromptManager()).toBe(promptManager);
    });

    it('应该通过 MCP 服务器获取 Prompt 列表', () => {
      const prompt: MCPPrompt = {
        name: 'server-prompt',
        description: '服务器提示词',
        template: '服务器模板',
        arguments: []
      };

      server.setPromptManager(promptManager);
      promptManager.registerPrompt(prompt);

      const prompts = server.getPrompts(); // ❌ 会失败
      expect(prompts).toContain(prompt);
    });

    it('应该通过 MCP 服务器渲染 Prompt', async () => {
      const prompt: MCPPrompt = {
        name: 'server-render',
        description: '服务器渲染提示词',
        template: '你好，{{name}}！',
        arguments: [
          {
            name: 'name',
            description: '用户名称',
            required: true
          }
        ]
      };

      server.setPromptManager(promptManager);
      promptManager.registerPrompt(prompt);

      const result = await server.renderPrompt('server-render', { name: '赵六' }); // ❌ 会失败
      expect(result).toBe('你好，赵六！');
    });

    it('应该在没有 Prompt 管理器时抛出错误', () => {
      expect(() => server.getPrompts())
        .toThrow('Prompt 管理器未设置');
    });
  });
});
