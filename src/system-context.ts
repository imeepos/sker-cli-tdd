/**
 * � TDD 重构阶段：系统上下文探索工具优化实现
 * 在绿灯状态下改进代码质量
 */

import * as os from 'os';
import { spawn } from 'child_process';
import { networkInterfaces } from 'os';

/**
 * 操作系统信息接口
 */
export interface OSInfo {
  platform: string;
  type: string;
  version: string;
  arch: string;
  release: string;
  hostname: string;
}

/**
 * 系统资源信息接口
 */
export interface SystemInfo {
  totalMemory: number;
  freeMemory: number;
  cpuCount: number;
  uptime: number;
  loadAverage: number[];
}

/**
 * 命令行工具信息接口
 */
export interface CommandLineTool {
  name: string;
  available: boolean;
  version?: string;
  path?: string;
  description?: string;
}

/**
 * Shell信息接口
 */
export interface ShellInfo {
  name: string;
  available: boolean;
  version?: string;
  path?: string;
  isDefault?: boolean;
}

/**
 * 网络接口信息
 */
export interface NetworkInterface {
  name: string;
  address: string;
  family: string;
  internal: boolean;
}

/**
 * 网络连接信息
 */
export interface NetworkConnectivity {
  internet: boolean;
  dns: boolean;
}

/**
 * 网络信息接口
 */
export interface NetworkInfo {
  interfaces: NetworkInterface[];
  connectivity: NetworkConnectivity;
}

/**
 * 系统上下文信息接口
 */
export interface SystemContext {
  os: OSInfo;
  system: SystemInfo;
  commandLineTools: CommandLineTool[];
  shells: ShellInfo[];
  currentShell: ShellInfo;
  environment: Record<string, string>;
  network: NetworkInfo;
  collectedAt: Date;
}

/**
 * 系统上下文收集器
 * 最小实现，只满足当前测试需求
 */
export class SystemContextCollector {
  private readonly commonTools = [
    'node', 'npm', 'git', 'python', 'java', 'docker', 'curl', 'wget'
  ];

  private readonly commonShells = [
    'bash', 'zsh', 'fish', 'cmd', 'powershell', 'pwsh', 'PowerShell'
  ];

  /**
   * 收集完整的系统上下文信息
   */
  async collectSystemContext(): Promise<SystemContext> {
    const [
      osInfo,
      systemInfo,
      commandLineTools,
      shells,
      currentShell,
      environment,
      networkInfo
    ] = await Promise.all([
      this.collectOSInfo(),
      this.collectSystemInfo(),
      this.collectCommandLineTools(),
      this.collectShells(),
      this.detectCurrentShell(),
      this.collectEnvironment(),
      this.collectNetworkInfo()
    ]);

    return {
      os: osInfo,
      system: systemInfo,
      commandLineTools,
      shells,
      currentShell,
      environment,
      network: networkInfo,
      collectedAt: new Date()
    };
  }

  /**
   * 收集操作系统信息
   */
  private async collectOSInfo(): Promise<OSInfo> {
    return {
      platform: os.platform(),
      type: os.type(),
      version: os.version(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname()
    };
  }

  /**
   * 收集系统资源信息
   */
  private async collectSystemInfo(): Promise<SystemInfo> {
    return {
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: os.cpus().length,
      uptime: os.uptime(),
      loadAverage: os.loadavg()
    };
  }

  /**
   * 收集命令行工具信息
   */
  private async collectCommandLineTools(): Promise<CommandLineTool[]> {
    const tools: CommandLineTool[] = [];
    
    for (const toolName of this.commonTools) {
      const toolInfo = await this.checkCommandLineTool(toolName);
      tools.push(toolInfo);
    }
    
    return tools.filter(tool => tool.available);
  }

  /**
   * 检查单个命令行工具
   */
  private async checkCommandLineTool(name: string): Promise<CommandLineTool> {
    try {
      const result = await this.executeCommand(`${name} --version`);
      return {
        name,
        available: result.success,
        version: result.output && result.output.length > 0 ? result.output.split('\n')[0]?.trim() : undefined,
        path: await this.getCommandPath(name)
      };
    } catch {
      return {
        name,
        available: false
      };
    }
  }

  /**
   * 获取命令路径
   */
  private async getCommandPath(command: string): Promise<string | undefined> {
    try {
      const whichCmd = os.platform() === 'win32' ? 'where' : 'which';
      const result = await this.executeCommand(`${whichCmd} ${command}`);
      return result.success && result.output && result.output.length > 0 ? result.output.split('\n')[0]?.trim() : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 收集Shell信息
   */
  private async collectShells(): Promise<ShellInfo[]> {
    const shells: ShellInfo[] = [];
    
    for (const shellName of this.commonShells) {
      const shellInfo = await this.checkShell(shellName);
      if (shellInfo.available) {
        shells.push(shellInfo);
      }
    }
    
    return shells;
  }

  /**
   * 检查单个Shell
   */
  private async checkShell(name: string): Promise<ShellInfo> {
    try {
      let versionCmd: string;

      if (name === 'cmd') {
        versionCmd = 'cmd /c ver';
      } else if (name === 'powershell' || name === 'PowerShell') {
        versionCmd = 'powershell -Command "$PSVersionTable.PSVersion"';
      } else if (name === 'pwsh') {
        versionCmd = 'pwsh -Command "$PSVersionTable.PSVersion"';
      } else {
        versionCmd = `${name} --version`;
      }

      const result = await this.executeCommand(versionCmd);

      return {
        name,
        available: result.success,
        version: result.output && result.output.length > 0 ? result.output.split('\n')[0]?.trim() : undefined,
        path: await this.getCommandPath(name)
      };
    } catch {
      return {
        name,
        available: false
      };
    }
  }

  /**
   * 检测当前Shell
   */
  private async detectCurrentShell(): Promise<ShellInfo> {
    const shellEnv = process.env['SHELL'] || process.env['ComSpec'] || 'unknown';
    const shellName = shellEnv.split(/[/\\]/).pop() || 'unknown';

    return {
      name: shellName,
      available: true,
      path: shellEnv,
      isDefault: true
    };
  }

  /**
   * 收集环境变量（过滤敏感信息）
   */
  private async collectEnvironment(): Promise<Record<string, string>> {
    const env = { ...process.env };
    const sensitiveKeys = ['PASSWORD', 'SECRET', 'TOKEN', 'KEY', 'PRIVATE'];
    
    // 过滤敏感环境变量
    Object.keys(env).forEach(key => {
      if (sensitiveKeys.some(sensitive => key.toUpperCase().includes(sensitive))) {
        delete env[key];
      }
    });
    
    // 确保包含重要的环境变量
    return {
      PATH: env['PATH'] || '',
      NODE_ENV: env['NODE_ENV'] || 'development',
      HOME: env['HOME'] || env['USERPROFILE'] || '',
      USER: env['USER'] || env['USERNAME'] || '',
      ...env
    };
  }

  /**
   * 收集网络信息
   */
  private async collectNetworkInfo(): Promise<NetworkInfo> {
    const interfaces = this.getNetworkInterfaces();
    const connectivity = await this.checkNetworkConnectivity();
    
    return {
      interfaces,
      connectivity
    };
  }

  /**
   * 获取网络接口信息
   */
  private getNetworkInterfaces(): NetworkInterface[] {
    const interfaces: NetworkInterface[] = [];
    const nets = networkInterfaces();
    
    Object.keys(nets).forEach(name => {
      nets[name]?.forEach(net => {
        interfaces.push({
          name,
          address: net.address,
          family: net.family,
          internal: net.internal
        });
      });
    });
    
    return interfaces;
  }

  /**
   * 检查网络连接状态
   */
  private async checkNetworkConnectivity(): Promise<NetworkConnectivity> {
    try {
      // 简单的网络连接检查
      const result = await this.executeCommand('ping -c 1 8.8.8.8 || ping -n 1 8.8.8.8');
      return {
        internet: result.success,
        dns: result.success
      };
    } catch {
      return {
        internet: false,
        dns: false
      };
    }
  }

  /**
   * 执行命令的辅助方法
   */
  private executeCommand(command: string): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const shell = os.platform() === 'win32' ? 'cmd' : 'sh';
      const flag = os.platform() === 'win32' ? '/c' : '-c';
      
      const child = spawn(shell, [flag, command], { stdio: 'pipe' });
      let output = '';
      
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        output += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output: output.trim() || ''
        });
      });

      child.on('error', () => {
        resolve({
          success: false,
          output: ''
        });
      });
    });
  }

  /**
   * 生成上下文摘要
   */
  async generateContextSummary(): Promise<string> {
    const context = await this.collectSystemContext();
    
    const summary = `
系统上下文摘要
================

操作系统信息:
- 平台: ${context.os.platform}
- 类型: ${context.os.type}
- 版本: ${context.os.version}
- 架构: ${context.os.arch}
- 主机名: ${context.os.hostname}

系统资源:
- 总内存: ${Math.round(context.system.totalMemory / 1024 / 1024 / 1024)}GB
- 可用内存: ${Math.round(context.system.freeMemory / 1024 / 1024 / 1024)}GB
- CPU核心数: ${context.system.cpuCount}
- 系统运行时间: ${Math.round(context.system.uptime / 3600)}小时

命令行工具 (${context.commandLineTools.length}个):
${context.commandLineTools.map(tool => `- ${tool.name}: ${tool.version || '未知版本'}`).join('\n')}

支持的Shell (${context.shells.length}个):
${context.shells.map(shell => `- ${shell.name}: ${shell.version || '未知版本'}`).join('\n')}

当前Shell: ${context.currentShell.name}

网络接口: ${context.network.interfaces.length}个
网络连接: ${context.network.connectivity.internet ? '正常' : '异常'}

收集时间: ${context.collectedAt.toLocaleString()}
    `.trim();
    
    return summary;
  }
}
