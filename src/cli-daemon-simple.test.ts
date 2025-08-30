/**
 * 简单的CLI守护进程测试
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CLIDaemon } from './cli-daemon';

describe('CLIDaemon Simple Tests', () => {
  let tempDir: string;
  let cliDaemon: CLIDaemon;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sker-cli-simple-'));
    cliDaemon = new CLIDaemon({
      socketPath: path.join(tempDir, 'daemon.sock'),
      pidFile: path.join(tempDir, 'daemon.pid'),
      logFile: path.join(tempDir, 'daemon.log')
    });
  });

  afterEach(() => {
    cliDaemon.cleanup();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('应该能够创建CLIDaemon实例', () => {
    expect(cliDaemon).toBeDefined();
  });

  it('应该能够解析简单的daemon命令', () => {
    const args = ['daemon', 'status'];
    const command = cliDaemon.parseCommand(args);
    
    expect(command.type).toBe('daemon');
    expect(command.action).toBe('status');
  });

  it('应该能够获取帮助信息', () => {
    const help = cliDaemon.getDaemonHelp();
    expect(help).toContain('daemon start');
    expect(help).toContain('daemon stop');
    expect(help).toContain('daemon status');
  });
});