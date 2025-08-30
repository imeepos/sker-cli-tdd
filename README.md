# 🤖 Sker AI - 智能编程助手

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![Test Coverage](https://img.shields.io/badge/Coverage-95%2B%25-brightgreen.svg)](https://github.com/imeepos/sker-cli-tdd)
[![TDD](https://img.shields.io/badge/Development-TDD-red.svg)](https://github.com/imeepos/sker-cli-tdd)
[![MCP](https://img.shields.io/badge/Protocol-MCP-purple.svg)](https://github.com/imeepos/sker-cli-tdd)
[![Production Ready](https://img.shields.io/badge/Status-Production%20Ready-green.svg)](https://github.com/imeepos/sker-cli-tdd)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

**生产就绪**的智能编程助手，基于 **模型上下文协议 (MCP)** 和严格的 **测试驱动开发 (TDD)** 构建。集成多种 AI 提供商，提供完整的开发工具链、智能 Agent 系统和**实时上下文同步**功能。

## ✨ 核心特性

### 🚀 **实时上下文同步系统** (全新!)
- **守护进程架构**：后台运行的文件监听服务
- **智能文件监听**：chokidar 驱动的跨平台文件变更检测
- **增量上下文更新**：仅更新变更文件，保持高性能
- **配置驱动**：项目级和全局级配置支持
- **性能监控**：健康检查、资源监控、统计信息

### 🧠 多 AI 提供商支持
- **OpenAI GPT 系列**：GPT-4, GPT-3.5-turbo 等
- **Anthropic Claude 系列**：Claude-3-sonnet, Claude-3-haiku 等
- **统一接口**：无缝切换不同 AI 提供商
- **故障转移**：自动切换备用 AI 服务

### 🛠️ 丰富的工具生态
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
- **增强CLI**：包含守护进程、文件监听、上下文管理命令
- **流式聊天**：实时对话体验
- **交互模式**：持续对话会话
- **编程接口**：作为 npm 包集成到项目中

## 🏗️ 项目架构

### 完整架构图
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI 工具      │    │  守护进程       │    │  文件系统       │
│                 │    │                 │    │                 │
│ • 启动命令      │◄──►│ • 文件监听      │◄──►│ • 项目文件      │
│ • 状态查询      │    │ • 事件处理      │    │ • 配置文件      │
│ • 配置管理      │    │ • IPC 服务      │    │ • 变更通知      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  上下文管理器   │    │  事件总线       │    │  缓存存储       │
│                 │    │                 │    │                 │
│ • Context 更新  │    │ • 事件分发      │    │ • LRU 缓存      │
│ • 依赖分析      │    │ • 防抖处理      │    │ • 持久化       │
│ • 内容压缩      │    │ • 错误恢复      │    │ • 版本控制      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  MCP 服务器     │    │  AI 客户端      │    │  Agent 系统     │
│                 │    │                 │    │                 │
│ • 工具管理      │    │ • OpenAI        │    │ • MQ Agent      │
│ • 资源管理      │    │ • Anthropic     │    │ • 任务分发      │
│ • 工作空间      │    │ • 统一接口      │    │ • AI 处理       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 项目结构

```
sker-ai/
├── src/                          # 源代码目录
│   ├── ai-clients/               # AI 客户端适配器
│   │   ├── base/                 # 统一接口和工厂
│   │   ├── openai/               # OpenAI 适配器
│   │   └── anthropic/            # Anthropic 适配器
│   ├── daemon/                   # 守护进程系统
│   │   ├── daemon-process.ts     # 守护进程主体
│   │   └── project-manager.ts    # 多项目管理
│   ├── ipc/                      # 进程间通信
│   │   ├── ipc-server.ts         # IPC 服务器
│   │   ├── ipc-client.ts         # IPC 客户端
│   │   └── ipc-protocol.ts       # IPC 协议
│   ├── watchers/                 # 文件监听系统
│   │   └── project-watcher.ts    # 项目文件监听器
│   ├── config/                   # 配置管理
│   │   └── watch-config.ts       # 监听配置管理
│   ├── monitoring/               # 监控系统
│   │   └── daemon-monitor.ts     # 守护进程监控
│   ├── cache/                    # 缓存系统
│   │   └── lru-cache.ts          # LRU 缓存实现
│   ├── analysis/                 # 依赖分析
│   │   └── dependency-analyzer.ts # 依赖关系分析
│   ├── optimization/             # 性能优化
│   │   ├── memory-optimizer.ts   # 内存优化
│   │   └── io-optimizer.ts       # I/O优化
│   ├── cli-daemon.ts             # 扩展CLI命令实现
│   ├── agent.ts                  # MQ Agent 系统
│   ├── mcp-server.ts             # MCP 协议服务器
│   ├── cli.ts                    # CLI 工具 (已扩展)
│   └── ...                       # 其他核心模块
├── examples/                     # 使用示例
├── coverage/                     # 测试覆盖率报告
├── PHASE_4_IMPLEMENTATION_SUMMARY.md # Phase 4 实现总结
└── tests/ (600+ 测试用例)        # 完整测试套件
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
# 运行所有测试 (600+ 测试用例)
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

## 💡 实时上下文同步使用指南

### 1. 守护进程管理
```bash
# 启动守护进程 (后台运行)
sker daemon start --background

# 查看守护进程状态
sker daemon status

# 停止守护进程
sker daemon stop

# 强制停止守护进程
sker daemon stop --force
```

### 2. 文件监听管理
```bash
# 为项目启用文件监听
sker watch enable ./my-project

# 启用监听并配置防抖延迟
sker watch enable ./my-project --debounce 200

# 禁用项目文件监听
sker watch disable ./my-project
```

### 3. 上下文管理
```bash
# 刷新项目上下文缓存
sker context refresh ./my-project

# 强制刷新 (忽略缓存)
sker context refresh ./my-project --force

# 按文件模式刷新
sker context refresh ./my-project --patterns "src/**/*.ts"

# 清除项目上下文缓存
sker context clear ./my-project
```

### 4. 配置文件

**项目配置 (sker.json)**：
```json
{
  "name": "my-project",
  "contextWatcher": {
    "enabled": true,
    "watchPatterns": [
      "src/**/*.{ts,js,tsx,jsx}",
      "docs/**/*.md",
      "*.json"
    ],
    "ignorePatterns": [
      "**/*.log",
      "tmp/**",
      "node_modules/**"
    ],
    "debounceMs": 100,
    "batchSize": 50,
    "maxDepth": 10,
    "respectGitignore": true,
    "cacheSize": "50MB",
    "compressionLevel": 1
  }
}
```

**全局配置 (~/.skerrc.json)**：
```json
{
  "daemon": {
    "enabled": true,
    "autoStart": true,
    "logLevel": "info",
    "logFile": "~/.sker/daemon.log",
    "pidFile": "~/.sker/daemon.pid",
    "socketPath": "~/.sker/daemon.sock"
  },
  "defaults": {
    "contextWatcher": {
      "debounceMs": 100,
      "batchSize": 50,
      "maxDepth": 8,
      "cacheSize": "100MB"
    }
  },
  "performance": {
    "maxMemoryMB": 200,
    "maxCpuPercent": 10,
    "gcInterval": 300000
  }
}
```

## 💻 传统CLI使用方式

### 1. CLI 交互模式
```bash
# 启动交互式聊天
sker --interactive

# 流式输出模式
sker --stream "帮我分析当前目录的文件结构"

# 显示完整帮助
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
  MCPAIClient,
  CLIDaemon
} from 'sker-ai';

// 创建实时上下文同步系统
const cliDaemon = new CLIDaemon({
  socketPath: '~/.sker/daemon.sock',
  pidFile: '~/.sker/daemon.pid',
  logFile: '~/.sker/daemon.log'
});

// 启动守护进程
await cliDaemon.startDaemon({ background: true });

// 为项目启用监听
await cliDaemon.enableWatch('./my-project', {
  debounceMs: 150,
  watchPatterns: ['src/**/*.ts', 'docs/**/*.md']
});

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
```

## 🔧 完整工具列表

### 🎯 **实时上下文工具 (新增!)**
- `daemon start` - 启动守护进程
- `daemon stop` - 停止守护进程
- `daemon status` - 查看守护进程状态
- `watch enable` - 启用文件监听
- `watch disable` - 禁用文件监听
- `context refresh` - 刷新上下文缓存
- `context clear` - 清除上下文缓存

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
describe('守护进程启动', () => {
  it('应该能够启动守护进程', async () => {
    const daemon = new CLIDaemon(); // 这里会失败 - 正确的！
    const result = await daemon.startDaemon();
    expect(result.success).toBe(true);
  });
});
```

### 🟢 绿阶段：最小实现
```typescript
// ✅ 只写刚好让测试通过的代码
export class CLIDaemon {
  async startDaemon(): Promise<DaemonResult> {
    return { success: true, message: '启动成功' };
  }
}
```

### 🔄 重构阶段：改进代码质量
```typescript
// 🔄 在保持测试通过的前提下改进代码
export class CLIDaemon {
  private config: DaemonConfig;
  
  constructor(config: DaemonConfig) {
    this.config = config;
  }
  
  async startDaemon(): Promise<DaemonResult> {
    // 检查守护进程是否已运行
    const status = await this.getDaemonStatus();
    if (status.isRunning) {
      return { success: false, message: '守护进程已在运行' };
    }
    
    // 实际启动逻辑
    return { success: true, message: '守护进程启动成功' };
  }
}
```

### 📊 测试覆盖率
```
Test Suites: 38 passed, 38 total ✅
Tests:       600+ passed, 600+ total ✅
Coverage:    95%+ lines, 95%+ functions, 95%+ branches ✅
```

## 🛠️ 技术栈

### 核心技术
- **TypeScript 5.9+** - 严格类型检查
- **Node.js** - 运行时环境
- **Jest** - 测试框架
- **Chokidar** - 跨平台文件监听

### 构建工具
- **tsup** - 快速 TypeScript 构建器
- **turbo** - 任务编排工具
- **tsx** - TypeScript 执行器

### 实时同步技术
- **Unix Socket/Named Pipe** - 高效IPC通信
- **EventEmitter** - 事件驱动架构
- **LRU Cache** - 智能缓存管理
- **防抖算法** - 批量处理优化

### AI 集成
- **OpenAI API** - GPT 系列模型
- **Anthropic API** - Claude 系列模型
- **统一接口** - 多提供商支持

### 消息队列
- **RabbitMQ** - Agent 系统消息队列
- **内存队列** - 开发测试用轻量级队列

## 📚 开发指南

### 代码规范
- **简体中文注释** - 所有代码注释使用简体中文
- **简体中文测试** - 测试用例描述使用简体中文
- **TypeScript 严格模式** - 启用所有严格检查
- **95%+ 测试覆盖率** - 高质量测试保障

### 开发流程
1. **🔴 红阶段** - 先写失败测试
2. **🟢 绿阶段** - 写最小实现代码
3. **🔄 重构阶段** - 改进代码质量
4. **📝 文档** - 更新文档和示例

## 🗺️ 开发路线图

### 已完成 ✅ (4/4 Phase 100%)
- [x] **Phase 1**: 基础文件监听系统
- [x] **Phase 2**: 守护进程架构 
- [x] **Phase 3**: 智能缓存和优化
- [x] **Phase 4**: CLI集成和配置
- [x] MCP 协议服务器实现
- [x] 多 AI 提供商支持 (OpenAI, Anthropic)
- [x] 完整的工具生态系统
- [x] Agent 系统和消息队列
- [x] **实时上下文同步系统**
- [x] 配置管理系统重构
- [x] 95%+ 测试覆盖率

### 计划中 📋
- [ ] 插件系统架构
- [ ] 更多 AI 提供商支持
- [ ] Web 界面开发
- [ ] 多语言代码生成支持
- [ ] 版本控制集成 (Git)
- [ ] 监控和分析系统

详细路线图请查看 [TODO_01.md](TODO_01.md)

## 🎉 项目状态

**🚀 状态: 生产就绪**

本项目已完成所有4个开发阶段，具备：
- ✅ 完整的实时上下文同步功能
- ✅ 守护进程架构和IPC通信
- ✅ 智能文件监听和缓存系统  
- ✅ 性能优化和资源管理
- ✅ 用户友好的CLI界面
- ✅ 600+测试用例，95%+覆盖率

## 📄 许可证

ISC License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎贡献代码！请遵循以下原则：

1. **严格遵循 TDD** - 先写测试，再写实现
2. **保持 95%+ 覆盖率** - 每行代码都要有测试
3. **使用简体中文** - 注释和测试描述
4. **类型安全** - 避免使用 `any` 类型

## 📞 联系方式

- **GitHub Issues** - [提交问题](https://github.com/imeepos/sker-cli-tdd/issues)
- **GitHub Discussions** - [参与讨论](https://github.com/imeepos/sker-cli-tdd/discussions)

---

**🎯 核心理念**：通过严格的 TDD 方法和现代化的工具链，构建高质量、可维护、可扩展的 AI 编程助手系统。现已实现**实时上下文同步**，让 AI 能够实时感知项目变化，提供更智能的编程协助。

**🎊 项目里程碑**: 从概念设计到生产就绪，严格按照TODO_01.md规划完成4个开发阶段，现已达到生产级质量标准！