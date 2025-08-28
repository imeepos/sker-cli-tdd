/**
 * 🔴 TDD 红阶段：MCP 配置持久化测试
 * 这些测试最初会失败 - 这是正确的 TDD 行为！
 */

import { MCPConfig } from './mcp-config'; // ❌ 这会失败 - 正确的！
import { MCPServer } from './mcp-server';
import { CalculatorToolsProvider } from './calculator-tools';
import * as fs from 'fs';
import * as path from 'path';

describe('MCP配置持久化', () => {
  const testConfigPath = path.join(__dirname, '../test-config.json');
  
  beforeEach(() => {
    // 清理测试配置文件
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  afterEach(() => {
    // 清理测试配置文件
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe('配置创建和初始化', () => {
    it('应该创建MCP配置实例', () => {
      const config = new MCPConfig(testConfigPath); // ❌ 会失败 - 类不存在
      expect(config).toBeInstanceOf(MCPConfig);
    });

    it('应该有默认的配置路径', () => {
      const config = new MCPConfig();
      expect(config.getConfigPath()).toBeDefined(); // ❌ 会失败
      expect(typeof config.getConfigPath()).toBe('string');
    });

    it('应该使用自定义配置路径', () => {
      const config = new MCPConfig(testConfigPath);
      expect(config.getConfigPath()).toBe(testConfigPath); // ❌ 会失败
    });
  });

  describe('配置文件操作', () => {
    let config: MCPConfig;

    beforeEach(() => {
      config = new MCPConfig(testConfigPath);
    });

    it('应该保存配置到文件', async () => {
      const testConfig = {
        tools: [
          {
            name: 'test-tool',
            description: '测试工具',
            schema: { type: 'object' }
          }
        ],
        resources: [
          {
            uri: 'file://test.txt',
            name: '测试文件',
            mimeType: 'text/plain'
          }
        ]
      };

      await config.saveConfig(testConfig); // ❌ 会失败
      expect(fs.existsSync(testConfigPath)).toBe(true);
    });

    it('应该从文件加载配置', async () => {
      const testConfig = {
        tools: [
          {
            name: 'test-tool',
            description: '测试工具',
            schema: { type: 'object' }
          }
        ],
        resources: []
      };

      // 先保存配置
      await config.saveConfig(testConfig);
      
      // 然后加载配置
      const loadedConfig = await config.loadConfig(); // ❌ 会失败
      expect(loadedConfig).toEqual(testConfig);
    });

    it('应该处理不存在的配置文件', async () => {
      const loadedConfig = await config.loadConfig();
      expect(loadedConfig).toEqual({
        tools: [],
        resources: []
      });
    });

    it('应该处理损坏的配置文件', async () => {
      // 写入无效的JSON
      fs.writeFileSync(testConfigPath, '{ invalid json }');
      
      const loadedConfig = await config.loadConfig();
      expect(loadedConfig).toEqual({
        tools: [],
        resources: []
      });
    });
  });

  describe('与MCP服务器集成', () => {
    let server: MCPServer;
    let config: MCPConfig;

    beforeEach(() => {
      server = new MCPServer();
      config = new MCPConfig(testConfigPath);
    });

    it('应该从服务器导出配置', async () => {
      // 注册一些工具和资源
      const calculatorProvider = new CalculatorToolsProvider();
      calculatorProvider.getTools().forEach(tool => {
        server.registerTool(tool);
      });

      server.registerResource({
        uri: 'file://test.txt',
        name: '测试文件',
        mimeType: 'text/plain'
      });

      // 导出配置
      await config.exportFromServer(server); // ❌ 会失败
      
      // 验证配置文件存在
      expect(fs.existsSync(testConfigPath)).toBe(true);
      
      // 验证配置内容
      const savedConfig = await config.loadConfig();
      expect(savedConfig.tools.length).toBe(4); // 4个计算器工具
      expect(savedConfig.resources.length).toBe(1);
    });

    it('应该将配置导入到服务器', async () => {
      const testConfig = {
        tools: [
          {
            name: 'test-tool',
            description: '测试工具',
            schema: { type: 'object' }
          }
        ],
        resources: [
          {
            uri: 'file://test.txt',
            name: '测试文件',
            mimeType: 'text/plain'
          }
        ]
      };

      // 保存配置
      await config.saveConfig(testConfig);
      
      // 导入到服务器
      await config.importToServer(server); // ❌ 会失败
      
      // 验证工具和资源已注册
      const tools = server.getTools();
      const resources = server.getResources();

      expect(tools.length).toBe(1);
      expect(tools[0]?.name).toBe('test-tool');
      expect(resources.length).toBe(1);
      expect(resources[0]?.uri).toBe('file://test.txt');
    });

    it('应该支持自动保存模式', async () => {
      // 启用自动保存
      config.enableAutoSave(server); // ❌ 会失败
      
      // 注册工具
      server.registerTool({
        name: 'auto-save-tool',
        description: '自动保存测试工具',
        handler: async () => ({ result: 'test' })
      });
      
      // 等待自动保存
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 验证配置已保存
      expect(fs.existsSync(testConfigPath)).toBe(true);
      const savedConfig = await config.loadConfig();
      expect(savedConfig.tools.some(tool => tool.name === 'auto-save-tool')).toBe(true);
    });

    it('应该支持禁用自动保存', () => {
      config.enableAutoSave(server);
      config.disableAutoSave(); // ❌ 会失败
      
      // 注册工具后不应该自动保存
      server.registerTool({
        name: 'no-auto-save-tool',
        description: '不自动保存的工具',
        handler: async () => ({ result: 'test' })
      });
      
      // 验证配置文件不存在
      expect(fs.existsSync(testConfigPath)).toBe(false);
    });
  });

  describe('配置验证', () => {
    let config: MCPConfig;

    beforeEach(() => {
      config = new MCPConfig(testConfigPath);
    });

    it('应该验证配置格式', () => {
      const validConfig = {
        tools: [
          {
            name: 'valid-tool',
            description: '有效工具',
            schema: { type: 'object' }
          }
        ],
        resources: [
          {
            uri: 'file://valid.txt',
            name: '有效文件',
            mimeType: 'text/plain'
          }
        ]
      };

      expect(config.validateConfig(validConfig)).toBe(true); // ❌ 会失败
    });

    it('应该拒绝无效的配置', () => {
      const invalidConfig = {
        tools: [
          {
            // 缺少必需的name字段
            description: '无效工具'
          }
        ],
        resources: []
      };

      expect(config.validateConfig(invalidConfig)).toBe(false);
    });
  });
});
