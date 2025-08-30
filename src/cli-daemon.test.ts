/**
 * 🔴 TDD 红阶段：CLI守护进程命令测试
 * 测试扩展的CLI命令：sker daemon start/stop/status, sker watch enable/disable, sker context refresh/clear
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CLIDaemon } from './cli-daemon';

// Mock所有依赖模块以避免真实的系统调用
jest.mock('./daemon/daemon-process', () => ({
  DaemonProcess: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(true),
    stop: jest.fn().mockResolvedValue(true),
    getStatus: jest.fn().mockResolvedValue({ isRunning: false })
  }))
}));

jest.mock('./monitoring/daemon-monitor', () => ({
  DaemonMonitor: jest.fn().mockImplementation(() => ({
    getDaemonStatus: jest.fn().mockResolvedValue({
      isRunning: false,
      pid: null,
      uptime: 0,
      memoryUsage: 0,
      projectCount: 0,
      health: { isHealthy: true, lastCheck: new Date() }
    }),
    start: jest.fn(),
    stop: jest.fn()
  }))
}));

jest.mock('./config/watch-config', () => ({
  WatchConfigManager: jest.fn().mockImplementation(() => ({
    getConfig: jest.fn().mockReturnValue({}),
    setConfig: jest.fn(),
    validatePath: jest.fn().mockReturnValue(true)
  }))
}));

jest.mock('./ipc/ipc-client', () => ({
  IPCClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    sendRequest: jest.fn().mockResolvedValue({ success: true })
  }))
}));

jest.mock('child_process', () => ({
  spawn: jest.fn().mockReturnValue({
    pid: 12345,
    unref: jest.fn(),
    kill: jest.fn(),
    killed: false
  })
}));

describe('CLIDaemon', () => {
  let tempDir: string;
  let cliDaemon: CLIDaemon;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock console.log to prevent Jest from capturing unexpected output
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // 创建临时目录用于测试
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sker-cli-daemon-test-'));
    cliDaemon = new CLIDaemon({
      socketPath: path.join(tempDir, 'daemon.sock'),
      pidFile: path.join(tempDir, 'daemon.pid'),
      logFile: path.join(tempDir, 'daemon.log')
    });

    // 设置更短的测试超时
    jest.setTimeout(10000);
  });

  afterEach(async () => {
    // 恢复console.log
    if (consoleSpy) {
      consoleSpy.mockRestore();
    }

    // 清理资源
    try {
      if (cliDaemon) {
        cliDaemon.cleanup();
      }
    } catch (error) {
      // 忽略清理错误
    }

    // 清理临时目录
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      // 忽略清理错误
    }

    // 清理所有Mock
    jest.clearAllMocks();
  });

  describe('daemon start 命令', () => {
    it('应该能够启动守护进程', async () => {
      const result = await cliDaemon.startDaemon();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('守护进程启动成功');
      expect(result.pid).toBeDefined();
    });

    it('应该在守护进程已运行时返回提示', async () => {
      // Mock守护进程已运行的状态
      const mockMonitor = (cliDaemon as any).monitor;
      mockMonitor.getDaemonStatus.mockResolvedValueOnce({
        isRunning: true,
        pid: 12345,
        uptime: 100,
        memoryUsage: 50,
        projectCount: 0,
        health: { isHealthy: true, lastCheck: new Date() }
      });
      
      // 尝试启动应该返回已运行的提示
      const result = await cliDaemon.startDaemon();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('守护进程已在运行');
    });

    it('应该创建PID文件', async () => {
      await cliDaemon.startDaemon();
      
      const pidFile = path.join(tempDir, 'daemon.pid');
      // 由于启动过程会创建PID文件
      expect(fs.existsSync(pidFile)).toBe(true);
      
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8'));
      expect(pid).toBeGreaterThan(0);
    });

    it('应该支持后台运行模式', async () => {
      const result = await cliDaemon.startDaemon({ background: true });
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('后台启动');
      expect(result.pid).toBeDefined();
    });
  });

  describe('daemon stop 命令', () => {
    it('应该能够停止守护进程', async () => {
      // Mock守护进程正在运行的状态
      const mockMonitor = (cliDaemon as any).monitor;
      mockMonitor.getDaemonStatus.mockResolvedValueOnce({
        isRunning: true,
        pid: 12345,
        uptime: 100,
        memoryUsage: 50,
        projectCount: 0,
        health: { isHealthy: true, lastCheck: new Date() }
      });

      // Mock process.kill to avoid actual process operations
      const originalKill = process.kill;
      process.kill = jest.fn();
      
      // 停止守护进程
      const result = await cliDaemon.stopDaemon();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('守护进程停止成功');

      // Restore process.kill
      process.kill = originalKill;
    });

    it('应该在守护进程未运行时返回提示', async () => {
      // Mock会默认返回isRunning: false
      const result = await cliDaemon.stopDaemon();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('守护进程未运行');
    });

    it('应该支持强制停止', async () => {
      // Mock守护进程正在运行的状态
      const mockMonitor = (cliDaemon as any).monitor;
      mockMonitor.getDaemonStatus.mockResolvedValueOnce({
        isRunning: true,
        pid: 12345,
        uptime: 100,
        memoryUsage: 50,
        projectCount: 0,
        health: { isHealthy: true, lastCheck: new Date() }
      });

      // Mock process.kill to avoid actual process operations
      const originalKill = process.kill;
      process.kill = jest.fn();
      
      // 强制停止
      const result = await cliDaemon.stopDaemon({ force: true });
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('强制停止');

      // Restore process.kill
      process.kill = originalKill;
    });

  });

  describe('daemon status 命令', () => {
    it('应该显示守护进程运行状态', async () => {
      const status = await cliDaemon.getDaemonStatus();
      
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('pid');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('memoryUsage');
      expect(status).toHaveProperty('projectCount');
    });

    it('应该显示健康检查状态', async () => {
      const status = await cliDaemon.getDaemonStatus();
      
      expect(status).toHaveProperty('health');
      expect(status.health).toHaveProperty('isHealthy');
      expect(status.health).toHaveProperty('lastCheck');
    });
  });

  describe('帮助信息', () => {
    it('应该显示daemon命令帮助', () => {
      const help = cliDaemon.getDaemonHelp();
      
      expect(help).toContain('daemon start');
      expect(help).toContain('daemon stop');
      expect(help).toContain('daemon status');
    });

    it('应该显示watch命令帮助', () => {
      const help = cliDaemon.getWatchHelp();
      
      expect(help).toContain('watch enable');
      expect(help).toContain('watch disable');
    });

    it('应该显示context命令帮助', () => {
      const help = cliDaemon.getContextHelp();
      
      expect(help).toContain('context refresh');
      expect(help).toContain('context clear');
    });
  });
});