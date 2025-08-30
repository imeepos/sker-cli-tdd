/**
 * 🔴 TDD 红阶段：CLI守护进程命令测试
 * 测试扩展的CLI命令：sker daemon start/stop/status, sker watch enable/disable, sker context refresh/clear
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CLIDaemon } from './cli-daemon';

describe('CLIDaemon', () => {
  let tempDir: string;
  let cliDaemon: CLIDaemon;

  beforeEach(() => {
    // 创建临时目录用于测试
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sker-cli-daemon-test-'));
    cliDaemon = new CLIDaemon({
      socketPath: path.join(tempDir, 'daemon.sock'),
      pidFile: path.join(tempDir, 'daemon.pid'),
      logFile: path.join(tempDir, 'daemon.log')
    });
  });

  afterEach(() => {
    // 清理资源
    cliDaemon.cleanup();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('daemon start 命令', () => {
    it('应该能够启动守护进程', async () => {
      const result = await cliDaemon.startDaemon();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('守护进程启动成功');
      expect(result.pid).toBeGreaterThan(0);
    });

    it('应该在守护进程已运行时返回提示', async () => {
      // 先启动守护进程
      await cliDaemon.startDaemon();
      
      // 再次启动应该返回已运行的提示
      const result = await cliDaemon.startDaemon();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('守护进程已在运行');
    });

    it('应该创建PID文件', async () => {
      await cliDaemon.startDaemon();
      
      const pidFile = path.join(tempDir, 'daemon.pid');
      expect(fs.existsSync(pidFile)).toBe(true);
      
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8'));
      expect(pid).toBeGreaterThan(0);
    });

    it('应该支持后台运行模式', async () => {
      const result = await cliDaemon.startDaemon({ background: true });
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('后台启动');
    });
  });

  describe('daemon stop 命令', () => {
    it('应该能够停止守护进程', async () => {
      // 先启动守护进程
      await cliDaemon.startDaemon();
      
      // 停止守护进程
      const result = await cliDaemon.stopDaemon();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('守护进程停止成功');
    });

    it('应该在守护进程未运行时返回提示', async () => {
      const result = await cliDaemon.stopDaemon();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('守护进程未运行');
    });

    it('应该支持强制停止', async () => {
      // 先启动守护进程
      await cliDaemon.startDaemon();
      
      // 强制停止
      const result = await cliDaemon.stopDaemon({ force: true });
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('强制停止');
    });

    it('应该清理PID文件', async () => {
      // 先启动守护进程
      await cliDaemon.startDaemon();
      const pidFile = path.join(tempDir, 'daemon.pid');
      expect(fs.existsSync(pidFile)).toBe(true);
      
      // 停止守护进程
      await cliDaemon.stopDaemon();
      expect(fs.existsSync(pidFile)).toBe(false);
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

    it('应该在守护进程运行时显示详细信息', async () => {
      // 启动守护进程
      await cliDaemon.startDaemon();
      
      const status = await cliDaemon.getDaemonStatus();
      
      expect(status.isRunning).toBe(true);
      expect(status.pid).toBeGreaterThan(0);
      expect(typeof status.uptime).toBe('number');
      expect(typeof status.memoryUsage).toBe('number');
    });

    it('应该显示项目数量统计', async () => {
      const status = await cliDaemon.getDaemonStatus();
      
      expect(typeof status.projectCount).toBe('number');
      expect(status.projectCount).toBeGreaterThanOrEqual(0);
    });

    it('应该显示健康检查状态', async () => {
      const status = await cliDaemon.getDaemonStatus();
      
      expect(status).toHaveProperty('health');
      expect(status.health).toHaveProperty('isHealthy');
      expect(status.health).toHaveProperty('lastCheck');
    });
  });

  describe('watch enable/disable 命令', () => {
    it('应该能够启用文件监听', async () => {
      const result = await cliDaemon.enableWatch('/test/project');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('文件监听已启用');
      expect(result.projectPath).toBe('/test/project');
    });

    it('应该能够禁用文件监听', async () => {
      // 先启用监听
      await cliDaemon.enableWatch('/test/project');
      
      // 禁用监听
      const result = await cliDaemon.disableWatch('/test/project');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('文件监听已禁用');
    });

    it('应该支持监听配置选项', async () => {
      const result = await cliDaemon.enableWatch('/test/project', {
        debounceMs: 200,
        watchPatterns: ['**/*.ts', '**/*.js'],
        ignorePatterns: ['node_modules/**']
      });
      
      expect(result.success).toBe(true);
      expect(result.config).toHaveProperty('debounceMs', 200);
      expect(result.config?.watchPatterns).toEqual(['**/*.ts', '**/*.js']);
    });

    it('应该验证项目路径是否存在', async () => {
      const result = await cliDaemon.enableWatch('/nonexistent/path');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('项目路径不存在');
    });
  });

  describe('context refresh/clear 命令', () => {
    it('应该能够刷新项目上下文', async () => {
      const result = await cliDaemon.refreshContext('/test/project');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('上下文刷新完成');
      expect(typeof result.filesProcessed).toBe('number');
      expect(typeof result.totalTime).toBe('number');
    });

    it('应该能够清除项目上下文缓存', async () => {
      const result = await cliDaemon.clearContext('/test/project');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('上下文缓存已清除');
      expect(typeof result.itemsCleared).toBe('number');
    });

    it('应该支持强制刷新', async () => {
      const result = await cliDaemon.refreshContext('/test/project', { force: true });
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('强制刷新');
    });

    it('应该支持指定刷新范围', async () => {
      const result = await cliDaemon.refreshContext('/test/project', {
        patterns: ['src/**/*.ts'],
        exclude: ['**/*.test.ts']
      });
      
      expect(result.success).toBe(true);
      expect(result.patterns).toEqual(['src/**/*.ts']);
      expect(result.exclude).toEqual(['**/*.test.ts']);
    });
  });

  describe('命令行参数解析', () => {
    it('应该解析daemon start命令', () => {
      const args = ['daemon', 'start', '--background'];
      const command = cliDaemon.parseCommand(args);
      
      expect(command.type).toBe('daemon');
      expect(command.action).toBe('start');
      expect(command.options['background']).toBe(true);
    });

    it('应该解析watch enable命令', () => {
      const args = ['watch', 'enable', '/project/path', '--debounce', '150'];
      const command = cliDaemon.parseCommand(args);
      
      expect(command.type).toBe('watch');
      expect(command.action).toBe('enable');
      expect(command.projectPath).toBe('/project/path');
      expect(command.options['debounce']).toBe(150);
    });

    it('应该解析context refresh命令', () => {
      const args = ['context', 'refresh', '/project/path', '--force', '--patterns', 'src/**/*.ts'];
      const command = cliDaemon.parseCommand(args);
      
      expect(command.type).toBe('context');
      expect(command.action).toBe('refresh');
      expect(command.projectPath).toBe('/project/path');
      expect(command.options['force']).toBe(true);
      expect(command.options['patterns']).toEqual(['src/**/*.ts']);
    });

    it('应该处理无效命令', () => {
      const args = ['invalid', 'command'];
      
      expect(() => {
        cliDaemon.parseCommand(args);
      }).toThrow('无效的命令');
    });
  });

  describe('帮助信息', () => {
    it('应该显示daemon命令帮助', () => {
      const help = cliDaemon.getDaemonHelp();
      
      expect(help).toContain('daemon start');
      expect(help).toContain('daemon stop');
      expect(help).toContain('daemon status');
      expect(help).toContain('启动守护进程');
      expect(help).toContain('停止守护进程');
      expect(help).toContain('查看守护进程状态');
    });

    it('应该显示watch命令帮助', () => {
      const help = cliDaemon.getWatchHelp();
      
      expect(help).toContain('watch enable');
      expect(help).toContain('watch disable');
      expect(help).toContain('启用文件监听');
      expect(help).toContain('禁用文件监听');
    });

    it('应该显示context命令帮助', () => {
      const help = cliDaemon.getContextHelp();
      
      expect(help).toContain('context refresh');
      expect(help).toContain('context clear');
      expect(help).toContain('刷新上下文缓存');
      expect(help).toContain('清除上下文缓存');
    });
  });
});