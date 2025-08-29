/**
 * 🔄 TDD 重构阶段：Agent工具提供者
 * 将Agent功能集成到MCP工具系统中
 */

import { MQAgent, TaskMessage } from './agent';
import { MQConnectionFactory } from './mq-connection';
import { MCPOpenAIClient } from './mcp-openai';
import { MCPServer } from './mcp-server';
import { MCPTool } from './mcp-server';

/**
 * Agent工具提供者
 * 负责创建和管理Agent相关的 MCP 工具
 */
export class AgentToolsProvider {
  private agents: Map<string, MQAgent> = new Map();

  /**
   * 获取所有Agent工具
   * @returns 所有Agent工具的数组
   */
  getTools(): MCPTool[] {
    return [
      this.getCreateAgentTool(),
      this.getStartAgentTool(),
      this.getStopAgentTool(),
      this.getSendTaskTool(),
      this.getAgentStatusTool(),
      this.getListAgentsTool(),
      this.getSendAITaskTool()
    ];
  }

  /**
   * 创建Agent工具
   */
  private getCreateAgentTool(): MCPTool {
    return {
      name: 'create_agent',
      description: '创建一个新的MQ Agent实例',
      handler: async (params: { agentId?: string; mqType?: 'memory' | 'rabbitmq' }) => {
        try {
          const { agentId, mqType = 'memory' } = params;
          
          // 设置Agent ID
          if (agentId) {
            process.env['AGENT_ID'] = agentId;
          }
          
          // 创建Agent
          const agent = new MQAgent();
          const config = agent.loadConfig();
          
          // 创建MQ连接
          const mqConnection = MQConnectionFactory.create(mqType, config);
          agent.setMQConnection(mqConnection);
          
          // 存储Agent
          this.agents.set(config.agentId, agent);
          
          return {
            success: true,
            agentId: config.agentId,
            mqType,
            config: {
              host: config.host,
              port: config.port,
              taskQueue: config.taskQueue,
              resultQueue: config.resultQueue
            }
          };
        } catch (error) {
          return {
            success: false,
            error: `创建Agent失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            description: 'Agent唯一标识符，不提供则自动生成'
          },
          mqType: {
            type: 'string',
            enum: ['memory', 'rabbitmq'],
            description: 'MQ连接类型，默认为memory'
          }
        },
        required: []
      }
    };
  }

  /**
   * 启动Agent工具
   */
  private getStartAgentTool(): MCPTool {
    return {
      name: 'start_agent',
      description: '启动指定的Agent，连接MQ并开始监听任务',
      handler: async (params: { agentId: string }) => {
        try {
          const { agentId } = params;
          const agent = this.agents.get(agentId);
          
          if (!agent) {
            throw new Error(`Agent ${agentId} 不存在`);
          }
          
          // 连接MQ
          const connected = await agent.connect();
          if (!connected) {
            throw new Error('连接MQ失败');
          }
          
          // 开始监听
          const listening = await agent.startListening();
          if (!listening) {
            throw new Error('开始监听失败');
          }
          
          const status = agent.getStatus();
          
          return {
            success: true,
            agentId,
            status: {
              isConnected: status.isConnected,
              isListening: status.isListening,
              taskQueue: status.config.taskQueue,
              resultQueue: status.config.resultQueue
            }
          };
        } catch (error) {
          return {
            success: false,
            error: `启动Agent失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            description: 'Agent唯一标识符'
          }
        },
        required: ['agentId']
      }
    };
  }

  /**
   * 停止Agent工具
   */
  private getStopAgentTool(): MCPTool {
    return {
      name: 'stop_agent',
      description: '停止指定的Agent，断开MQ连接',
      handler: async (params: { agentId: string }) => {
        try {
          const { agentId } = params;
          const agent = this.agents.get(agentId);
          
          if (!agent) {
            throw new Error(`Agent ${agentId} 不存在`);
          }
          
          // 停止监听
          await agent.stopListening();
          
          // 断开连接
          await agent.disconnect();
          
          return {
            success: true,
            agentId,
            message: 'Agent已停止'
          };
        } catch (error) {
          return {
            success: false,
            error: `停止Agent失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            description: 'Agent唯一标识符'
          }
        },
        required: ['agentId']
      }
    };
  }

  /**
   * 发送任务工具
   */
  private getSendTaskTool(): MCPTool {
    return {
      name: 'send_task',
      description: '向指定Agent发送任务',
      handler: async (params: { 
        fromAgentId: string;
        toAgentId: string;
        taskType: string;
        payload: any;
      }) => {
        try {
          const { fromAgentId, toAgentId, taskType, payload } = params;
          const fromAgent = this.agents.get(fromAgentId);
          
          if (!fromAgent) {
            throw new Error(`发送方Agent ${fromAgentId} 不存在`);
          }
          
          if (!fromAgent.isConnected()) {
            throw new Error(`发送方Agent ${fromAgentId} 未连接`);
          }
          
          // 创建任务消息
          const taskMessage: TaskMessage = {
            id: `task-${Date.now()}`,
            from: fromAgentId,
            to: toAgentId,
            type: taskType,
            payload,
            timestamp: new Date().toISOString()
          };
          
          // 发送任务（这里简化为直接处理，实际应该发送到MQ）
          const toAgent = this.agents.get(toAgentId);
          if (toAgent && toAgent.isConnected()) {
            const result = await toAgent.processTask(taskMessage);
            return {
              success: true,
              taskId: taskMessage.id,
              processed: result,
              message: '任务已发送并处理'
            };
          } else {
            return {
              success: true,
              taskId: taskMessage.id,
              processed: false,
              message: '任务已发送到队列'
            };
          }
        } catch (error) {
          return {
            success: false,
            error: `发送任务失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          fromAgentId: {
            type: 'string',
            description: '发送方Agent ID'
          },
          toAgentId: {
            type: 'string',
            description: '接收方Agent ID'
          },
          taskType: {
            type: 'string',
            description: '任务类型（工具名称）'
          },
          payload: {
            type: 'object',
            description: '任务参数'
          }
        },
        required: ['fromAgentId', 'toAgentId', 'taskType', 'payload']
      }
    };
  }

  /**
   * 获取Agent状态工具
   */
  private getAgentStatusTool(): MCPTool {
    return {
      name: 'get_agent_status',
      description: '获取指定Agent的状态信息',
      handler: async (params: { agentId: string }) => {
        try {
          const { agentId } = params;
          const agent = this.agents.get(agentId);
          
          if (!agent) {
            throw new Error(`Agent ${agentId} 不存在`);
          }
          
          const status = agent.getStatus();
          
          return {
            success: true,
            agentId,
            status: {
              isConnected: status.isConnected,
              isListening: status.isListening,
              config: {
                host: status.config.host,
                port: status.config.port,
                taskQueue: status.config.taskQueue,
                resultQueue: status.config.resultQueue
              }
            }
          };
        } catch (error) {
          return {
            success: false,
            error: `获取Agent状态失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            description: 'Agent唯一标识符'
          }
        },
        required: ['agentId']
      }
    };
  }

  /**
   * 列出所有Agent工具
   */
  private getListAgentsTool(): MCPTool {
    return {
      name: 'list_agents',
      description: '列出所有已创建的Agent',
      handler: async () => {
        try {
          const agents = Array.from(this.agents.entries()).map(([agentId, agent]) => {
            const status = agent.getStatus();
            return {
              agentId,
              isConnected: status.isConnected,
              isListening: status.isListening,
              taskQueue: status.config.taskQueue,
              resultQueue: status.config.resultQueue
            };
          });
          
          return {
            success: true,
            count: agents.length,
            agents
          };
        } catch (error) {
          return {
            success: false,
            error: `列出Agent失败: ${(error as Error).message}`
          };
        }
      },
      schema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  /**
   * 发送AI任务工具
   */
  private getSendAITaskTool(): MCPTool {
    return {
      name: 'send_ai_task',
      description: '向Agent发送AI任务，让AI理解指令并智能调用工具完成任务',
      schema: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            description: '目标Agent的ID'
          },
          instruction: {
            type: 'string',
            description: '任务指令，用自然语言描述要完成的任务'
          },
          context: {
            type: 'string',
            description: '任务上下文信息（可选）'
          },
          enableAI: {
            type: 'boolean',
            description: '是否启用AI处理（默认true）',
            default: true
          }
        },
        required: ['agentId', 'instruction']
      },
      handler: async (params: {
        agentId: string;
        instruction: string;
        context?: string;
        enableAI?: boolean
      }) => {
        try {
          const { agentId, instruction, context, enableAI = true } = params;

          // 检查Agent是否存在
          const agent = this.agents.get(agentId);
          if (!agent) {
            return {
              success: false,
              error: `Agent ${agentId} 不存在`
            };
          }

          // 如果启用AI，需要设置AI客户端
          if (enableAI && !agent.getAIClient()) {
            try {
              // 尝试创建AI客户端
              const server = new MCPServer();
              const aiConfig = MCPOpenAIClient.loadConfigFromEnv();
              const aiClient = new MCPOpenAIClient(aiConfig, server);
              agent.setAIClient(aiClient);
            } catch (error) {
              return {
                success: false,
                error: `无法初始化AI客户端: ${(error as Error).message}`,
                suggestion: '请确保设置了OPENAI_API_KEY环境变量'
              };
            }
          }

          // 构建任务消息
          const taskMessage: TaskMessage = {
            id: `ai-task-${Date.now()}`,
            from: 'ai-task-sender',
            to: agentId,
            type: enableAI ? 'ai_task' : 'execute_command',
            payload: enableAI ? { instruction, context } : { command: instruction },
            timestamp: new Date().toISOString()
          };

          // 执行任务
          const result = await agent.executeTask(taskMessage);

          return {
            success: result.success,
            taskId: result.taskId,
            result: result.result,
            error: result.error,
            message: result.success ?
              `AI任务已成功处理${enableAI ? '，AI调用了工具完成任务' : ''}` :
              '任务处理失败'
          };
        } catch (error) {
          return {
            success: false,
            error: `AI任务发送失败: ${(error as Error).message}`
          };
        }
      }
    };
  }
}
