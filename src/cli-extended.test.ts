/**
 * 🔴 TDD 红阶段：扩展CLI功能测试
 * 测试新增的daemon、watch、context命令集成
 */

import { CLI } from './cli';

describe('CLI Extended Commands', () => {
  let cli: CLI;

  beforeEach(() => {
    cli = new CLI();
  });

  afterEach(() => {
    // 清理资源
  });

  describe('帮助信息', () => {
    it('应该包含新的命令帮助', () => {
      const help = cli.getHelpText();
      
      expect(help).toContain('daemon');
      expect(help).toContain('watch');
      expect(help).toContain('context');
      expect(help).toContain('启动守护进程');
      expect(help).toContain('启用文件监听');
      expect(help).toContain('刷新上下文缓存');
    });
  });

  describe('方法存在性检查', () => {
    it('应该具备处理守护进程命令的方法', () => {
      expect(typeof cli.handleDaemonCommand).toBe('function');
    });

    it('应该具备处理监听命令的方法', () => {
      expect(typeof cli.handleWatchCommand).toBe('function');
    });

    it('应该具备处理上下文命令的方法', () => {
      expect(typeof cli.handleContextCommand).toBe('function');
    });
  });

  describe('版本信息', () => {
    it('应该返回版本号', () => {
      const version = cli.getVersion();
      expect(version).toBe('1.0.0');
    });
  });
});