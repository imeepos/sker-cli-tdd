/**
 * 🚀 MQ Agent 系统使用示例
 * 演示如何使用Agent监听MQ任务并执行工具
 * 支持 MQ_URL 和分离配置两种方式
 */

import { MQAgent, TaskMessage } from '../src/agent';
import { MQConnectionFactory } from '../src/mq-connection';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

/**
 * MQ_URL配置示例
 */
export async function runMQUrlConfigExample(): Promise<void> {
  console.log('\n🚀 启动MQ_URL配置示例...\n');

  try {
    // 设置MQ_URL环境变量
    process.env['MQ_URL'] = 'amqp://guest:guest@localhost:5672';
    process.env['AGENT_ID'] = 'url-config-agent';

    // 创建Agent
    const agent = new MQAgent();

    // 显示配置信息
    const config = agent.loadConfig();
    console.log('📋 Agent配置信息:');
    console.log(`   MQ URL: ${config.url}`);
    console.log(`   主机: ${config.host}`);
    console.log(`   端口: ${config.port}`);
    console.log(`   用户名: ${config.username}`);
    console.log(`   密码: ${config.password}`);
    console.log(`   Agent ID: ${config.agentId}`);
    console.log(`   任务队列: ${config.taskQueue}`);
    console.log(`   结果队列: ${config.resultQueue}`);

    // 创建内存MQ连接（用于演示）
    const mqConnection = MQConnectionFactory.create('memory');
    agent.setMQConnection(mqConnection);

    // 连接并启动
    console.log('\n🔌 连接到MQ服务器...');
    await agent.connect();
    await agent.startListening();

    console.log('✅ Agent已启动并监听任务队列');

    // 停止Agent
    await agent.stopListening();
    await agent.disconnect();

    console.log('✅ MQ_URL配置示例完成！');

  } catch (error) {
    console.error(`❌ 示例执行失败: ${(error as Error).message}`);
  }
}

/**
 * 基础Agent示例
 */
export async function runBasicAgentExample(): Promise<void> {
  console.log('\n🚀 启动基础Agent示例...\n');

  try {
    // 创建Agent
    const agent = new MQAgent();
    
    // 创建内存MQ连接（用于演示）
    const mqConnection = MQConnectionFactory.create('memory');
    agent.setMQConnection(mqConnection);

    // 连接到MQ
    console.log('🔌 连接到MQ服务器...');
    const connected = await agent.connect();
    if (!connected) {
      throw new Error('Failed to connect to MQ');
    }

    // 显示Agent状态
    const status = agent.getStatus();
    console.log('📊 Agent状态:');
    console.log(`   Agent ID: ${status.agentId}`);
    console.log(`   连接状态: ${status.isConnected ? '已连接' : '未连接'}`);
    console.log(`   监听状态: ${status.isListening ? '监听中' : '未监听'}`);
    console.log(`   任务队列: ${status.config.taskQueue}`);
    console.log(`   结果队列: ${status.config.resultQueue}`);

    // 开始监听任务
    console.log('\n📡 开始监听任务队列...');
    const listening = await agent.startListening();
    if (!listening) {
      throw new Error('Failed to start listening');
    }

    // 模拟发送一些任务
    console.log('\n📤 发送测试任务...');
    
    // 任务1: 执行命令
    const task1: TaskMessage = {
      id: 'task-001',
      from: 'client-001',
      to: status.agentId,
      type: 'execute_command',
      payload: { command: 'echo "Hello from Agent!"' },
      timestamp: new Date().toISOString()
    };

    // 任务2: 获取系统信息
    const task2: TaskMessage = {
      id: 'task-002',
      from: 'client-001',
      to: status.agentId,
      type: 'get_os_info',
      payload: {},
      timestamp: new Date().toISOString()
    };

    // 任务3: 读取文件
    const task3: TaskMessage = {
      id: 'task-003',
      from: 'client-001',
      to: status.agentId,
      type: 'read_file',
      payload: { path: 'package.json' },
      timestamp: new Date().toISOString()
    };

    // 发送任务到队列
    await mqConnection.publish(status.config.taskQueue, JSON.stringify(task1));
    await mqConnection.publish(status.config.taskQueue, JSON.stringify(task2));
    await mqConnection.publish(status.config.taskQueue, JSON.stringify(task3));

    console.log('✅ 已发送3个测试任务');

    // 等待任务处理
    console.log('\n⏳ 等待任务处理...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 停止监听
    console.log('\n🛑 停止监听...');
    await agent.stopListening();

    // 断开连接
    console.log('🔌 断开MQ连接...');
    await agent.disconnect();

    console.log('\n✅ 基础Agent示例完成！');

  } catch (error) {
    console.error(`❌ 示例执行失败: ${(error as Error).message}`);
  }
}

/**
 * 多Agent协作示例
 */
export async function runMultiAgentExample(): Promise<void> {
  console.log('\n🚀 启动多Agent协作示例...\n');

  try {
    // 创建多个Agent
    const agents = [
      new MQAgent(),
      new MQAgent(),
      new MQAgent()
    ];

    // 为每个Agent设置不同的ID
    process.env['AGENT_ID'] = 'agent-worker-1';
    agents[0] = new MQAgent();
    
    process.env['AGENT_ID'] = 'agent-worker-2';
    agents[1] = new MQAgent();
    
    process.env['AGENT_ID'] = 'agent-worker-3';
    agents[2] = new MQAgent();

    // 创建共享的MQ连接
    const mqConnection = MQConnectionFactory.create('memory');

    // 连接所有Agent
    console.log('🔌 连接所有Agent到MQ...');
    for (let i = 0; i < agents.length; i++) {
      agents[i].setMQConnection(mqConnection);
      await agents[i].connect();
      await agents[i].startListening();
      
      const status = agents[i].getStatus();
      console.log(`   Agent ${i + 1}: ${status.agentId} - 已连接并监听`);
    }

    // 发送多个任务
    console.log('\n📤 发送多个任务给不同Agent...');
    
    const tasks = [
      {
        id: 'task-001',
        from: 'coordinator',
        to: 'agent-worker-1',
        type: 'get_system_summary',
        payload: {},
        timestamp: new Date().toISOString()
      },
      {
        id: 'task-002',
        from: 'coordinator',
        to: 'agent-worker-2',
        type: 'get_command_line_tools',
        payload: {},
        timestamp: new Date().toISOString()
      },
      {
        id: 'task-003',
        from: 'coordinator',
        to: 'agent-worker-3',
        type: 'execute_command',
        payload: { command: 'node --version' },
        timestamp: new Date().toISOString()
      }
    ];

    // 发送任务
    for (const task of tasks) {
      await mqConnection.publish('task_queue', JSON.stringify(task));
      console.log(`   发送任务 ${task.id} 给 ${task.to}`);
    }

    // 等待处理
    console.log('\n⏳ 等待所有任务处理完成...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 清理
    console.log('\n🧹 清理所有Agent...');
    for (const agent of agents) {
      await agent.stopListening();
      await agent.disconnect();
    }

    console.log('\n✅ 多Agent协作示例完成！');

  } catch (error) {
    console.error(`❌ 多Agent示例执行失败: ${(error as Error).message}`);
  }
}

/**
 * 错误处理示例
 */
export async function runErrorHandlingExample(): Promise<void> {
  console.log('\n🚀 启动错误处理示例...\n');

  try {
    const agent = new MQAgent();
    const mqConnection = MQConnectionFactory.create('memory');
    agent.setMQConnection(mqConnection);

    await agent.connect();
    await agent.startListening();

    const status = agent.getStatus();
    console.log(`📊 Agent ${status.agentId} 已准备就绪`);

    // 发送各种错误任务
    console.log('\n📤 发送错误任务进行测试...');

    const errorTasks = [
      // 无效的工具类型
      {
        id: 'error-task-001',
        from: 'client',
        to: status.agentId,
        type: 'invalid_tool_type',
        payload: {},
        timestamp: new Date().toISOString()
      },
      // 缺少必需参数
      {
        id: 'error-task-002',
        from: 'client',
        to: status.agentId,
        type: 'execute_command',
        payload: {}, // 缺少command参数
        timestamp: new Date().toISOString()
      },
      // 文件不存在
      {
        id: 'error-task-003',
        from: 'client',
        to: status.agentId,
        type: 'read_file',
        payload: { path: 'non-existent-file.txt' },
        timestamp: new Date().toISOString()
      }
    ];

    for (const task of errorTasks) {
      await mqConnection.publish(status.config.taskQueue, JSON.stringify(task));
      console.log(`   发送错误任务: ${task.id} (${task.type})`);
    }

    // 等待错误处理
    console.log('\n⏳ 等待错误处理...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 清理
    await agent.stopListening();
    await agent.disconnect();

    console.log('\n✅ 错误处理示例完成！');

  } catch (error) {
    console.error(`❌ 错误处理示例失败: ${(error as Error).message}`);
  }
}

/**
 * 主函数 - 运行所有示例
 */
export async function runAllAgentExamples(): Promise<void> {
  console.log('🤖 MQ Agent 系统完整示例');
  console.log('=' .repeat(60));

  await runMQUrlConfigExample();
  await runBasicAgentExample();
  await runMultiAgentExample();
  await runErrorHandlingExample();

  console.log('\n✅ 所有Agent示例完成！');
  console.log('🎯 Agent系统现在可以处理MQ任务并调用各种工具！');
  console.log('🔗 支持标准MQ_URL配置格式！');
  console.log('=' .repeat(60));
}

// 如果直接运行此文件
if (require.main === module) {
  runAllAgentExamples().catch(console.error);
}
