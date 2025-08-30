/**
 * 🔴 TDD 红阶段：交互式模式测试
 * 测试交互式聊天模式和命令处理
 */

import { InteractiveMode } from './interactive-mode';
import { StreamChat } from './stream-chat';
import { ToolManager } from './tool-manager';
import inquirer from 'inquirer';

// Mock 依赖
jest.mock('./stream-chat');
jest.mock('./tool-manager');
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

const mockPrompt = inquirer.prompt as jest.MockedFunction<typeof inquirer.prompt>;

describe('交互式模式', () => {
  let interactiveMode: InteractiveMode;
  let mockStreamChat: jest.Mocked<StreamChat>;
  let mockToolManager: jest.Mocked<ToolManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    // 设置 inquirer mock
    mockPrompt.mockResolvedValue({ input: 'test input' });

    // 创建 mock 对象
    mockStreamChat = {
      chat: jest.fn(),
      chatWithTools: jest.fn(),
      getConversationHistory: jest.fn().mockReturnValue([]),
      clearHistory: jest.fn(),
      setRealTimeOutput: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        totalMessages: 0,
        totalTokens: 0,
        totalToolCalls: 0,
      }),
      resetStats: jest.fn(),
      getStorageStats: jest.fn().mockResolvedValue({
        totalSessions: 0,
        totalMessages: 0,
        dbSize: 0
      }),
      loadSessionHistory: jest.fn(),
      getSessionInfo: jest.fn(),
      deleteSession: jest.fn(),
      listSessions: jest.fn().mockResolvedValue([]),
      createSession: jest.fn().mockResolvedValue('test-session-id'),
      getAIClient: jest.fn(),
      getMCPServer: jest.fn(),
      getChatStorage: jest.fn(),
      initializeStorage: jest.fn(),
      closeStorage: jest.fn(),
      setCurrentSession: jest.fn(),
      getCurrentSessionId: jest.fn()
    } as jest.Mocked<Partial<StreamChat>> as jest.Mocked<StreamChat>;

    mockToolManager = {
      getAvailableTools: jest.fn().mockReturnValue([]),
      getAllToolsHelp: jest.fn().mockReturnValue('可用工具列表'),
      getToolStats: jest.fn().mockReturnValue({
        totalTools: 0,
        totalExecutions: 0,
        successRate: 0,
      }),
    } as any;

    interactiveMode = new InteractiveMode(mockStreamChat, mockToolManager);
  });

  describe('初始化', () => {
    it('应该正确创建交互式模式实例', () => {
      expect(interactiveMode).toBeInstanceOf(InteractiveMode);
    });

    it('应该返回 StreamChat 实例', () => {
      const streamChat = interactiveMode.getStreamChat();
      expect(streamChat).toBe(mockStreamChat);
    });

    it('应该返回 ToolManager 实例', () => {
      const toolManager = interactiveMode.getToolManager();
      expect(toolManager).toBe(mockToolManager);
    });
  });

  describe('命令识别', () => {
    it('应该识别退出命令', () => {
      expect(interactiveMode.isExitCommand('/exit')).toBe(true);
      expect(interactiveMode.isExitCommand('/quit')).toBe(true);
      expect(interactiveMode.isExitCommand('hello')).toBe(false);
    });

    it('应该识别帮助命令', () => {
      expect(interactiveMode.isHelpCommand('/help')).toBe(true);
      expect(interactiveMode.isHelpCommand('/h')).toBe(true);
      expect(interactiveMode.isHelpCommand('help')).toBe(false);
    });

    it('应该识别清除命令', () => {
      expect(interactiveMode.isClearCommand('/clear')).toBe(true);
      expect(interactiveMode.isClearCommand('/cls')).toBe(true);
      expect(interactiveMode.isClearCommand('clear')).toBe(false);
    });

    it('应该识别统计命令', () => {
      expect(interactiveMode.isStatsCommand('/stats')).toBe(true);
      expect(interactiveMode.isStatsCommand('/stat')).toBe(false);
    });

    it('应该识别工具命令', () => {
      expect(interactiveMode.isToolsCommand('/tools')).toBe(true);
      expect(interactiveMode.isToolsCommand('/t')).toBe(true);
      expect(interactiveMode.isToolsCommand('tools')).toBe(false);
    });

    it('应该识别会话命令', () => {
      expect(interactiveMode.isSessionCommand('/sessions')).toBe(true);
      expect(interactiveMode.isSessionCommand('sessions')).toBe(false);
    });

    it('应该识别新会话命令', () => {
      expect(interactiveMode.isNewSessionCommand('/new')).toBe(true);
      expect(interactiveMode.isNewSessionCommand('new')).toBe(false);
    });

    it('应该识别加载会话命令', () => {
      expect(interactiveMode.isLoadSessionCommand('/load')).toBe(true);
      expect(interactiveMode.isLoadSessionCommand('load')).toBe(false);
    });

    it('应该识别数据库统计命令', () => {
      expect(interactiveMode.isDbStatsCommand('/dbstats')).toBe(true);
      expect(interactiveMode.isDbStatsCommand('dbstats')).toBe(false);
    });
  });

  describe('命令执行', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('应该执行帮助命令', async () => {
      await interactiveMode.executeCommand('/help');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('可用命令'));
    });

    it('应该执行清除命令', async () => {
      await interactiveMode.executeCommand('/clear');
      expect(mockStreamChat.clearHistory).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✅ 对话历史已清除');
    });

    it('应该执行统计命令', async () => {
      await interactiveMode.executeCommand('/stats');
      expect(mockStreamChat.getStats).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('统计信息'));
    });

    it('应该执行工具命令', async () => {
      await interactiveMode.executeCommand('/tools');
      expect(mockToolManager.getAllToolsHelp).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('可用工具列表'));
    });

    it('应该处理未知命令', async () => {
      await interactiveMode.executeCommand('/unknown');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('未知命令'));
    });

    it('应该执行会话列表命令', async () => {
      await interactiveMode.executeCommand('/sessions');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('保存的会话'));
    });

    it('应该执行新会话命令', async () => {
      await interactiveMode.executeCommand('/new');
      expect(mockStreamChat.createSession).toHaveBeenCalledWith(undefined);
      expect(consoleSpy).toHaveBeenCalledWith('✅ 创建新会话: test-session-id');
    });

    it('应该执行加载会话命令', async () => {
      await interactiveMode.executeCommand('/load session1');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('加载'));
    });

    it('应该处理缺少会话ID的加载命令', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      await interactiveMode.executeCommand('/load');
      expect(logSpy).toHaveBeenCalledWith('❌ 请指定会话ID: /load <session-id>');
      logSpy.mockRestore();
    });

    it('应该处理空会话ID的加载命令', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      await interactiveMode.executeCommand('/load   ');
      expect(logSpy).toHaveBeenCalledWith('❌ 请指定会话ID: /load <session-id>');
      logSpy.mockRestore();
    });

    it('应该执行数据库统计命令', async () => {
      const mockDbStats = {
        totalSessions: 10,
        totalMessages: 100,
        dbSize: 1024
      };
      mockStreamChat.getStorageStats = jest.fn().mockResolvedValue(mockDbStats);
      
      await interactiveMode.executeCommand('/dbstats');
      
      expect(mockStreamChat.getStorageStats).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('数据库统计'));
    });
  });

  describe('配置管理', () => {
    it('应该设置实时输出', () => {
      mockStreamChat.setRealTimeOutput = jest.fn();
      interactiveMode.setRealTimeOutput(true);
      expect(mockStreamChat.setRealTimeOutput).toHaveBeenCalledWith(true);
    });

    it('应该获取会话配置', () => {
      const config = interactiveMode.getSessionConfig();
      
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('应该更新会话配置', () => {
      const newConfig = { model: 'gpt-3.5-turbo', temperature: 0.5, realTimeOutput: true };
      mockStreamChat.setRealTimeOutput = jest.fn();
      
      interactiveMode.updateSessionConfig(newConfig);
      
      expect(mockStreamChat.setRealTimeOutput).toHaveBeenCalledWith(true);
    });

    it('应该能够更新实时输出配置', () => {
      const newConfig = { realTimeOutput: false };
      
      interactiveMode.updateSessionConfig(newConfig);
      
      expect(mockStreamChat.setRealTimeOutput).toHaveBeenCalledWith(false);
    });

    it('应该能够更新配置但不设置realTimeOutput', () => {
      const newConfig = {
        autoSave: true,
        maxHistory: 100,
      };

      interactiveMode.updateSessionConfig(newConfig);

      // realTimeOutput未定义时不应该调用setRealTimeOutput
      expect(mockStreamChat.setRealTimeOutput).not.toHaveBeenCalled();
    });
  });

  describe('错误处理', () => {
    it('应该处理会话加载错误', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      mockStreamChat.loadSessionHistory.mockRejectedValue(new Error('Session not found'));
      
      await interactiveMode.executeCommand('/load invalid_session');
      
      expect(logSpy).toHaveBeenCalledWith('❌ 加载会话失败: Session not found');
      logSpy.mockRestore();
    });

    it('应该处理聊天消息错误', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockStreamChat.chat = jest.fn().mockRejectedValue(new Error('聊天错误'));
      
      await interactiveMode.handleMessage('测试消息');
      
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('聊天错误'));
      errorSpy.mockRestore();
    });

    it('应该处理工具聊天消息错误', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockStreamChat.chatWithTools = jest.fn().mockRejectedValue(new Error('工具错误'));
      
      await interactiveMode.handleMessageWithTools('测试消息');
      
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('聊天错误'));
      errorSpy.mockRestore();
    });
  });

  describe('会话管理', () => {
    it('应该显示欢迎消息', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      interactiveMode.showWelcomeMessage();
      
      expect(consoleSpy).toHaveBeenCalledWith('🤖 进入交互式聊天模式');
      consoleSpy.mockRestore();
    });

    it('应该处理空会话列表', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await interactiveMode.executeCommand('/sessions');
      
      expect(consoleSpy).toHaveBeenCalledWith('📂 暂无保存的会话');
      consoleSpy.mockRestore();
    });

    it('应该能够保存会话', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await interactiveMode.saveSession('test-session');
      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('💾 会话 "test-session" 已保存 (0 条消息)');
      consoleSpy.mockRestore();
    });

    it('应该处理保存会话失败', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      // 模拟获取历史记录时抛出错误
      mockStreamChat.getConversationHistory.mockImplementationOnce(() => {
        throw new Error('Save failed');
      });
      
      const result = await interactiveMode.saveSession('test-session');
      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('❌ 保存会话失败: Save failed');
      
      errorSpy.mockRestore();
    });

    it('应该能够加载会话', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await interactiveMode.loadSession('test-session');
      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('📂 会话 "test-session" 已加载');
      consoleSpy.mockRestore();
    });

    it('应该处理加载会话失败', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      // 模拟加载会话时抛出错误 - 通过抛出同步错误来触发catch块
      const originalConsoleLog = console.log;
      console.log = jest.fn().mockImplementation(() => {
        throw new Error('Load failed');
      });
      
      const result = await interactiveMode.loadSession('test-session');
      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('❌ 加载会话失败: Load failed');
      
      console.log = originalConsoleLog;
      errorSpy.mockRestore();
    });

    it('应该能够列出保存的会话 - 无会话', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await interactiveMode.listSavedSessions();
      
      expect(mockStreamChat.listSessions).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('📂 暂无保存的会话');
      
      consoleSpy.mockRestore();
    });

    it('应该能够列出保存的会话 - 有会话', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockSessions = [
        {
          id: 'session-1',
          name: 'Test Session 1',
          updatedAt: new Date('2024-01-01').getTime(),
          messageCount: 5
        },
        {
          id: 'session-2', 
          name: 'Test Session 2',
          updatedAt: new Date('2024-01-02').getTime(),
          messageCount: 3
        }
      ];
      
      // 重置mock调用记录
      mockStreamChat.listSessions.mockClear();
      mockStreamChat.listSessions.mockResolvedValueOnce(mockSessions);
      
      await interactiveMode.listSavedSessions();
      
      expect(mockStreamChat.listSessions).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('\n📂 最近的会话:');
      expect(consoleSpy).toHaveBeenCalledWith('  1. Test Session 1 (ID: session-1)');
      expect(consoleSpy).toHaveBeenCalledWith('  2. Test Session 2 (ID: session-2)');
      
      consoleSpy.mockRestore();
    });

    it('应该能够创建新会话 - 不带会话名', async () => {
       const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
       mockStreamChat.createSession.mockResolvedValueOnce('new-session-id');
       
       await interactiveMode.executeCommand('/new');
       
       expect(mockStreamChat.createSession).toHaveBeenCalledWith(undefined);
       expect(consoleSpy).toHaveBeenCalledWith('✅ 创建新会话: new-session-id');
       
       consoleSpy.mockRestore();
     });

     it('应该能够创建新会话 - 带会话名', async () => {
       const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
       mockStreamChat.createSession.mockResolvedValueOnce('named-session-id');
       
       await interactiveMode.executeCommand('/new 我的测试会话');
       
       expect(mockStreamChat.createSession).toHaveBeenCalledWith('我的测试会话');
       expect(consoleSpy).toHaveBeenCalledWith('✅ 创建新会话: named-session-id');
       
       consoleSpy.mockRestore();
     });

    it('应该能够配置实时输出', () => {
        interactiveMode.updateSessionConfig({ realTimeOutput: false });
        
        expect(mockStreamChat.setRealTimeOutput).toHaveBeenCalledWith(false);
      });
   });

  describe('start方法', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it('应该处理退出命令', async () => {
      mockPrompt
        .mockResolvedValueOnce({ message: '/exit' });

      await interactiveMode.start();

      expect(consoleSpy).toHaveBeenCalledWith('👋 再见！');
    });

    it('应该处理无效输入', async () => {
      mockPrompt
        .mockResolvedValueOnce({ message: null })
        .mockResolvedValueOnce({ message: '/exit' });

      await interactiveMode.start();

      expect(consoleSpy).toHaveBeenCalledWith('❌ 输入无效，请重试');
    });

    it('应该处理空消息', async () => {
      mockPrompt
        .mockResolvedValueOnce({ message: '' })
        .mockResolvedValueOnce({ message: '/exit' });

      await interactiveMode.start();

      expect(consoleSpy).toHaveBeenCalledWith('❌ 输入无效，请重试');
    });

    it('应该处理会话错误并退出', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockPrompt
        .mockRejectedValueOnce(new Error('输入错误'));

      await interactiveMode.start();

      expect(errorSpy).toHaveBeenCalledWith('❌ 会话错误: 输入错误');
    });

    it('应该处理命令执行', async () => {
      const executeCommandSpy = jest.spyOn(interactiveMode, 'executeCommand').mockResolvedValue();
      mockPrompt
        .mockResolvedValueOnce({ message: '/help' })
        .mockResolvedValueOnce({ message: '/exit' });

      await interactiveMode.start();

      expect(executeCommandSpy).toHaveBeenCalledWith('/help');
    });

    it('应该处理普通消息', async () => {
      const handleMessageSpy = jest.spyOn(interactiveMode, 'handleMessage').mockResolvedValue();
      mockPrompt
        .mockResolvedValueOnce({ message: '你好' })
        .mockResolvedValueOnce({ message: '/exit' });

      await interactiveMode.start();

      expect(handleMessageSpy).toHaveBeenCalledWith('你好');
    });
  });

  describe('聊天处理', () => {
    it('应该能够处理普通聊天消息', async () => {
      mockStreamChat.chat.mockResolvedValue({
        content: 'Hello World',
        tokens: 10,
      });

      await interactiveMode.handleMessage('Hello');

      expect(mockStreamChat.chat).toHaveBeenCalledWith('Hello');
    });

    it('应该能够处理工具聊天消息', async () => {
      mockStreamChat.chatWithTools.mockResolvedValue({
        content: 'Tool response',
        tokens: 15,
        toolCalls: [],
      });

      await interactiveMode.handleMessageWithTools('Use tools');

      expect(mockStreamChat.chatWithTools).toHaveBeenCalledWith('Use tools');
    });
  });
});
