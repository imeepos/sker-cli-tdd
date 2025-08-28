/**
 * TypeScript TDD 项目的主入口点
 * 遵循 TDD 原则：导出已测试的功能
 *
 * 🔄 TDD 重构阶段：增强的导出包含 MCP 服务器
 */

export { Calculator } from './calculator';
export { MCPServer, MCPTool, MCPResource } from './mcp-server';
export { CalculatorToolsProvider } from './calculator-tools';
export { MCPConfig, MCPConfigData } from './mcp-config';
export { runMCPExample } from './mcp-example';
export { runMCPConfigExample } from './mcp-config-example';

// 为方便使用，重新导出所有模块的内容
export * from './calculator';
export * from './mcp-server';
export * from './calculator-tools';
export * from './mcp-config';
export * from './mcp-example';
export * from './mcp-config-example';
