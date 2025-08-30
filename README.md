# 🤖 Sker AI - 智能编程助手

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen.svg)](https://github.com/imeepos/sker-cli-tdd)
[![TDD](https://img.shields.io/badge/Development-TDD-red.svg)](https://github.com/imeepos/sker-cli-tdd)
[![MCP](https://img.shields.io/badge/Protocol-MCP-purple.svg)](https://github.com/imeepos/sker-cli-tdd)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

基于 **模型上下文协议 (MCP)** 的智能编程助手，采用严格的 **测试驱动开发 (TDD)** 方法构建。集成多种 AI 提供商，提供完整的开发工具链和智能 Agent 系统。

## ✨ 核心特性

### 🧠 多 AI 提供商支持
- **OpenAI GPT 系列**：GPT-4, GPT-3.5-turbo 等
- **Anthropic Claude 系列**：Claude-3-sonnet, Claude-3-haiku 等
- **统一接口**：无缝切换不同 AI 提供商
- **故障转移**：自动切换备用 AI 服务

### � 丰富的工具生态
- **文件操作**：读写、创建、删除、搜索、权限管理
- **命令执行**：跨平台系统命令执行，支持编码转换
- **网络请求**：HTTP/HTTPS 请求，JSON API 调用
- **系统信息**：操作系统、网络、Shell 环境检测
- **Agent 管理**：创建、启动、停止、任务分发
- **TODO 管理**：任务创建、查询、统计、持久化存储

### 🤖 智能 Agent 系统
- **消息队列**：基于 RabbitMQ 的任务分发
- **AI 驱动**：智能理解和执行复杂任务
- **工具调用**：自动选择合适的工具完成任务
- **多 Agent 协作**：支持 Agent 间通信和协作

### 💻 多种使用方式
- **CLI 工具**：命令行交互式使用
- **流式聊天**：实时对话体验
- **交互模式**：持续对话会话
- **编程接口**：作为 npm 包集成到项目中

## 🏗️ 项目架构

### 核心架构图
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI 工具      │    │  MCP 服务器     │    │  AI 客户端      │
│                 │    │                 │    │                 │
│ • 命令行界面    │◄──►│ • 工具管理      │◄──►│ • OpenAI        │
│ • 交互模式      │    │ • 资源管理      │    │ • Anthropic     │
│ • 流式聊天      │    │ • 工作空间      │    │ • 统一接口      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  工具提供者     │    │  Agent 系统     │    │  配置管理       │
│                 │    │                 │    │                 │
│ • 文件工具      │    │ • MQ Agent      │    │ • 环境变量      │
│ • 命令工具      │    │ • 任务分发      │    │ • 统一配置      │
│ • 网络工具      │    │ • AI 处理       │    │ • 类型安全      │
│ • 系统工具      │    │ • 工具调用      │    │ • 默认值       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Project Structure

```
sker-ai/
├── src/                          # 源代码目录
│   ├── ai-clients/               # AI 客户端适配器
│   │   ├── base/                 # 统一接口和工厂
│   │   ├── openai/               # OpenAI 适配器
│   │   └── anthropic/            # Anthropic 适配器
│   ├── agent.ts                  # MQ Agent 系统
│   ├── agent-tools.ts            # Agent 工具提供者
│   ├── mcp-server.ts             # MCP 协议服务器
│   ├── mcp-ai-client.ts          # MCP AI 客户端
│   ├── tool-manager.ts           # 工具管理器
│   ├── config-manager.ts         # 配置管理器
│   ├── cli.ts                    # CLI 工具
│   ├── file-tools.ts             # 文件操作工具
│   ├── command-tools.ts          # 命令执行工具
│   ├── fetch-tools.ts            # 网络请求工具
│   ├── system-context-tools.ts   # 系统信息工具
│   ├── todo-tools.ts             # TODO 管理工具
│   └── ...                       # 其他核心模块
├── examples/                     # 使用示例
│   ├── mcp-example.ts            # MCP 服务器示例
│   ├── ai-with-internet-example.ts # AI 联网查询示例
│   ├── file-tools-example.ts     # 文件工具示例
│   └── command-tools-example.ts  # 命令工具示例
├── dist/                         # 构建输出
├── coverage/                     # 测试覆盖率报告
├── docs/                         # 文档目录
│   ├── CLAUDE.md                 # Claude TDD 开发指南
│   └── TODO.md                   # 开发路线图
└── tests/                        # 测试文件 (540+ 测试用例)
```

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 环境配置
创建 `.env` 文件：
```bash
# AI 配置 (必需)
AI_PROVIDER=openai                    # 或 anthropic
AI_API_KEY=your_api_key_here
AI_MODEL=gpt-4                        # 或 claude-3-sonnet-20240229
AI_BASE_URL=https://api.openai.com/v1 # 可选，自定义 API 端点

# MQ 配置 (可选，用于 Agent 系统)
MQ_URL=amqp://localhost:5672          # 或使用分离配置
MQ_HOST=localhost
MQ_PORT=5672
MQ_USERNAME=guest
MQ_PASSWORD=guest
MQ_TASK_QUEUE=task_queue
MQ_RESULT_QUEUE=result_queue
AGENT_ID=my-agent-001

# 其他配置
NODE_ENV=development
```

### 运行测试 (TDD 优先!)
```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 覆盖率报告
npm run test:coverage
```

### 构建项目
```bash
npm run build
```

### 使用 CLI 工具
```bash
# 开发模式
npm run cli

# 构建后使用
npm run cli:build

# 或全局安装后
sker --help
```

## 💡 使用示例

### 1. CLI 交互模式
```bash
# 启动交互式聊天
sker --interactive

# 流式输出模式
sker --stream "帮我分析当前目录的文件结构"

# 显示帮助
sker --help
```

### 2. 编程接口使用
```typescript
import {
  MCPServer,
  ToolManager,
  MCPWorkspaceManager,
  FileToolsProvider,
  CommandToolsProvider,
  MCPAIClient
} from 'sker-ai';

// 创建 MCP 服务器
const server = new MCPServer();
const workspaceManager = new MCPWorkspaceManager();
const toolManager = new ToolManager(server, workspaceManager);

// 注册工具提供者
toolManager.registerToolProvider(new FileToolsProvider());
toolManager.registerToolProvider(new CommandToolsProvider());

// 创建 AI 客户端
const aiClient = new MCPAIClient({
  provider: 'openai',
  apiKey: 'your-api-key',
  model: 'gpt-4'
}, server);

// 执行工具
const result = await toolManager.executeTool('read_file', {
  path: './package.json'
});

console.log(result);
```

### 3. Agent 系统使用
```typescript
import { AgentToolsProvider, MQAgent } from 'sker-ai';

// 创建 Agent 工具提供者
const agentTools = new AgentToolsProvider();

// 通过工具创建 Agent
const createResult = await toolManager.executeTool('create_agent', {
  agentId: 'my-agent',
  mqType: 'rabbitmq' // 或 'memory'
});

// 发送 AI 任务给 Agent
const taskResult = await toolManager.executeTool('send_ai_task', {
  agentId: 'my-agent',
  instruction: '分析当前项目的代码结构并生成报告',
  context: '这是一个 TypeScript 项目',
  enableAI: true
});
```

## 🔧 可用工具

### 📁 文件操作工具
- `read_file` - 读取文件内容
- `write_file` - 写入文件内容
- `create_file` - 创建新文件
- `delete_file` - 删除文件
- `copy_file` - 复制文件
- `move_file` - 移动文件
- `search_files` - 搜索文件
- `search_content` - 搜索文件内容
- `check_permissions` - 检查文件权限
- `set_permissions` - 设置文件权限

### 💻 命令执行工具
- `execute_command` - 执行系统命令

### 🌐 网络请求工具
- `fetch_url` - 获取 URL 内容
- `fetch_json` - 获取 JSON 数据

### 🖥️ 系统信息工具
- `get_system_context` - 获取完整系统上下文
- `get_system_summary` - 获取系统摘要
- `get_os_info` - 获取操作系统信息
- `get_command_line_tools` - 获取命令行工具信息
- `get_shell_info` - 获取 Shell 信息
- `get_network_info` - 获取网络信息

### 🤖 Agent 管理工具
- `create_agent` - 创建新 Agent
- `start_agent` - 启动 Agent
- `stop_agent` - 停止 Agent
- `send_task` - 发送任务给 Agent
- `send_ai_task` - 发送 AI 任务给 Agent
- `get_agent_status` - 获取 Agent 状态
- `list_agents` - 列出所有 Agent

### ✅ TODO 管理工具
- `add_todo` - 添加 TODO 项
- `list_todos` - 列出 TODO 项
- `get_todo` - 获取特定 TODO
- `update_todo` - 更新 TODO
- `delete_todo` - 删除 TODO
- `complete_todo` - 完成 TODO
- `query_todos` - 查询 TODO
- `get_todo_stats` - 获取 TODO 统计
- `clear_todos` - 清空 TODO

## 🧪 测试驱动开发 (TDD)

本项目严格遵循 **红-绿-重构** 循环：

### 🔴 红阶段：编写失败测试
```typescript
// ❌ 先写失败的测试
describe('MCPServer', () => {
  it('应该能够注册和执行工具', async () => {
    const server = new MCPServer(); // 这里会失败 - 正确的！
    // ... 测试代码
  });
});
```

### 🟢 绿阶段：最小实现
```typescript
// ✅ 只写刚好让测试通过的代码
export class MCPServer {
  registerTool(tool: MCPTool): void {
    // 最简实现
  }
}
```

### 🔄 重构阶段：改进代码质量
```typescript
// 🔄 在保持测试通过的前提下改进代码
export class MCPServer {
  private tools: Map<string, MCPTool> = new Map();

  registerTool(tool: MCPTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`工具 "${tool.name}" 已注册`);
    }
    this.tools.set(tool.name, tool);
  }
}
```

### 📊 测试覆盖率
```
Test Suites: 36 passed, 36 total ✅
Tests:       540 passed, 540 total ✅
Coverage:    100% lines, 100% functions, 100% branches
```
## 🛠️ 技术栈

### 核心技术
- **TypeScript 5.9+** - 严格类型检查
- **Node.js** - 运行时环境
- **Jest** - 测试框架

### 构建工具
- **tsup** - 快速 TypeScript 构建器
- **turbo** - 任务编排工具
- **tsx** - TypeScript 执行器

### AI 集成
- **OpenAI API** - GPT 系列模型
- **Anthropic API** - Claude 系列模型
- **统一接口** - 多提供商支持

### 消息队列
- **RabbitMQ** - Agent 系统消息队列
- **内存队列** - 开发测试用轻量级队列

### 数据存储
- **LevelDB** - 轻量级键值存储
- **文件系统** - 配置和缓存存储

## 📚 开发指南

### 代码规范
- **简体中文注释** - 所有代码注释使用简体中文
- **简体中文测试** - 测试用例描述使用简体中文
- **TypeScript 严格模式** - 启用所有严格检查
- **100% 测试覆盖率** - 每行代码都有测试

### 开发流程
1. **🔴 红阶段** - 先写失败测试
2. **🟢 绿阶段** - 写最小实现代码
3. **🔄 重构阶段** - 改进代码质量
4. **📝 文档** - 更新文档和示例

### 贡献指南
1. Fork 项目
2. 创建功能分支
3. 遵循 TDD 原则开发
4. 确保测试覆盖率 100%
5. 提交 Pull Request

## 🗺️ 开发路线图

### 已完成 ✅
- [x] MCP 协议服务器实现
- [x] 多 AI 提供商支持 (OpenAI, Anthropic)
- [x] 完整的工具生态系统
- [x] Agent 系统和消息队列
- [x] CLI 工具和交互模式
- [x] 配置管理系统重构
- [x] 100% 测试覆盖率

### 进行中 🚧
- [ ] 插件系统架构
- [ ] 更多 AI 提供商支持
- [ ] Web 界面开发
- [ ] 性能优化

### 计划中 📋
- [ ] 多语言代码生成支持
- [ ] 版本控制集成 (Git)
- [ ] 数据库操作工具
- [ ] 云服务集成
- [ ] 监控和分析系统

详细路线图请查看 [TODO.md](TODO.md)

## 📄 许可证

ISC License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎贡献代码！请遵循以下原则：

1. **严格遵循 TDD** - 先写测试，再写实现
2. **保持 100% 覆盖率** - 每行代码都要有测试
3. **使用简体中文** - 注释和测试描述
4. **类型安全** - 避免使用 `any` 类型

## 📞 联系方式

- **GitHub Issues** - [提交问题](https://github.com/imeepos/sker-cli-tdd/issues)
- **GitHub Discussions** - [参与讨论](https://github.com/imeepos/sker-cli-tdd/discussions)

---

**🎯 核心理念**：通过严格的 TDD 方法和现代化的工具链，构建高质量、可维护、可扩展的 AI 编程助手系统。


