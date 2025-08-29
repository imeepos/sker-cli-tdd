/**
 * 简化的交互式模式测试
 * 专门测试修复后的错误处理
 */

import { InteractiveMode } from './interactive-mode';
import { StreamChat } from './stream-chat';
import { ToolManager } from './tool-manager';

// Mock 依赖
jest.mock('./stream-chat');
jest.mock('./tool-manager');
jest.mock('inquirer');

describe('交互式模式 - 错误处理修复', () => {
  let interactiveMode: InteractiveMode;
  let mockStreamChat: jest.Mocked<StreamChat>;
  let mockToolManager: jest.Mocked<ToolManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStreamChat = {
      chat: jest.fn(),
      chatWithTools: jest.fn(),
      getConversationHistory: jest.fn().mockReturnValue([]),
      clearHistory: jest.fn(),
      setRealTimeOutput: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        totalMessages: 0,
        totalTokens: 0,
        totalToolCalls: 0
      }),
      resetStats: jest.fn()
    } as any;

    mockToolManager = {
      getAvailableTools: jest.fn().mockReturnValue([]),
      getAllToolsHelp: jest.fn().mockReturnValue('可用工具列表'),
      getToolStats: jest.fn().mockReturnValue({
        totalTools: 0,
        totalExecutions: 0,
        successRate: 0
      })
    } as any;

    interactiveMode = new InteractiveMode(mockStreamChat, mockToolManager);
  });

  describe('命令处理', () => {
    it('应该能够识别退出命令', () => {
      expect(interactiveMode.isExitCommand('/exit')).toBe(true);
      expect(interactiveMode.isExitCommand('/quit')).toBe(true);
      expect(interactiveMode.isExitCommand('/q')).toBe(true);
      expect(interactiveMode.isExitCommand('hello')).toBe(false);
    });

    it('应该能够识别帮助命令', () => {
      expect(interactiveMode.isHelpCommand('/help')).toBe(true);
      expect(interactiveMode.isHelpCommand('/h')).toBe(true);
      expect(interactiveMode.isHelpCommand('/?')).toBe(true);
      expect(interactiveMode.isHelpCommand('hello')).toBe(false);
    });

    it('应该能够执行帮助命令', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await interactiveMode.executeCommand('/help');
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('可用命令'));
      consoleSpy.mockRestore();
    });

    it('应该能够执行清除命令', async () => {
      const consoleSpy = jest.spyOn(console, 'clear').mockImplementation();
      
      await interactiveMode.executeCommand('/clear');
      
      expect(mockStreamChat.clearHistory).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('聊天处理', () => {
    it('应该能够处理普通聊天消息', async () => {
      mockStreamChat.chat.mockResolvedValue({
        content: 'Hello World',
        tokens: 10
      });

      await interactiveMode.handleMessage('Hello');
      
      expect(mockStreamChat.chat).toHaveBeenCalledWith('Hello');
    });

    it('应该能够处理聊天错误', async () => {
      mockStreamChat.chat.mockRejectedValue(new Error('API 错误'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await interactiveMode.handleMessage('Hello');
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('API 错误'));
      consoleSpy.mockRestore();
    });
  });

  describe('配置管理', () => {
    it('应该能够设置实时输出', () => {
      interactiveMode.setRealTimeOutput(false);
      
      expect(mockStreamChat.setRealTimeOutput).toHaveBeenCalledWith(false);
    });

    it('应该能够获取会话配置', () => {
      const config = interactiveMode.getSessionConfig();
      
      expect(config).toHaveProperty('realTimeOutput');
      expect(config).toHaveProperty('autoSave');
      expect(config).toHaveProperty('maxHistory');
    });

    it('应该能够更新会话配置', () => {
      const newConfig = {
        realTimeOutput: false,
        autoSave: true,
        maxHistory: 100
      };

      interactiveMode.updateSessionConfig(newConfig);
      
      const config = interactiveMode.getSessionConfig();
      expect(config.realTimeOutput).toBe(false);
      expect(config.autoSave).toBe(true);
      expect(config.maxHistory).toBe(100);
    });
  });

  describe('会话管理', () => {
    it('应该能够保存会话', async () => {
      mockStreamChat.getConversationHistory.mockReturnValue([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ]);

      const result = await interactiveMode.saveSession('test-session');
      
      expect(result).toBe(true);
      expect(mockStreamChat.getConversationHistory).toHaveBeenCalled();
    });

    it('应该能够加载会话', async () => {
      const result = await interactiveMode.loadSession('test-session');
      
      expect(typeof result).toBe('boolean');
    });

    it('应该能够列出保存的会话', () => {
      const sessions = interactiveMode.listSavedSessions();
      
      expect(Array.isArray(sessions)).toBe(true);
    });
  });
});
