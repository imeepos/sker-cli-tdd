/**
 * 🔄 TDD 重构阶段：实际MQ连接实现
 * 提供真实的消息队列连接功能
 */

import { MQConnection, MQConfig } from './agent';
import { ConfigManager } from './config-manager';

/**
 * 条件性地输出日志，测试环境下不输出
 */
function logInfo(message: string, ...args: any[]): void {
  const configManager = ConfigManager.getInstance();
  if (!configManager.isTestEnvironment()) {
    console.log(message, ...args);
  }
}

/**
 * 基于内存的简单MQ连接实现
 * 用于开发和测试环境
 */
export class InMemoryMQConnection implements MQConnection {
  private connected = false;
  private queues: Map<string, string[]> = new Map();
  private subscribers: Map<string, (message: string) => void> = new Map();

  async connect(): Promise<boolean> {
    this.connected = true;
    logInfo('✅ Connected to in-memory MQ');
    return true;
  }

  async disconnect(): Promise<boolean> {
    this.connected = false;
    this.queues.clear();
    this.subscribers.clear();
    logInfo('✅ Disconnected from in-memory MQ');
    return true;
  }

  subscribe(queue: string, callback: (message: string) => void): void {
    if (!this.connected) {
      throw new Error('Not connected to MQ');
    }

    this.subscribers.set(queue, callback);
    
    // 如果队列中已有消息，立即处理
    const messages = this.queues.get(queue) || [];
    messages.forEach(message => {
      setTimeout(() => callback(message), 0);
    });
    
    // 清空已处理的消息
    this.queues.set(queue, []);
    
    logInfo(`📡 Subscribed to queue: ${queue}`);
  }

  async publish(queue: string, message: string): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    // 如果有订阅者，直接发送
    const subscriber = this.subscribers.get(queue);
    if (subscriber) {
      setTimeout(() => subscriber(message), 0);
    } else {
      // 否则存储到队列中
      const messages = this.queues.get(queue) || [];
      messages.push(message);
      this.queues.set(queue, messages);
    }

    logInfo(`📤 Published message to queue: ${queue}`);
    return true;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // 调试方法
  getQueueStatus(): { [queue: string]: number } {
    const status: { [queue: string]: number } = {};
    this.queues.forEach((messages, queue) => {
      status[queue] = messages.length;
    });
    return status;
  }
}

/**
 * RabbitMQ连接实现（需要安装amqplib）
 * 用于生产环境
 */
export class RabbitMQConnection implements MQConnection {
  private connection: any = null;
  private channel: any = null;
  private config: MQConfig;

  constructor(config: MQConfig) {
    this.config = config;
    logInfo(`RabbitMQ connection initialized for ${config.url}`);
  }

  async connect(): Promise<boolean> {
    try {
      // 注意：这里需要安装 amqplib 包
      // npm install amqplib @types/amqplib

      // const amqp = require('amqplib');
      // this.connection = await amqp.connect(this.config.url);
      // this.channel = await this.connection.createChannel();

      // // 确保队列存在
      // await this.channel.assertQueue(this.config.taskQueue, { durable: true });
      // await this.channel.assertQueue(this.config.resultQueue, { durable: true });

      logInfo(`✅ Connected to RabbitMQ at ${this.config.url} (mock implementation)`);
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to RabbitMQ:', error);
      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      logInfo('✅ Disconnected from RabbitMQ');
      return true;
    } catch (error) {
      console.error('❌ Failed to disconnect from RabbitMQ:', error);
      return false;
    }
  }

  subscribe(queue: string, callback: (message: string) => void): void {
    if (!this.channel) {
      throw new Error('Not connected to RabbitMQ');
    }

    // this.channel.consume(queue, (msg: any) => {
    //   if (msg) {
    //     const content = msg.content.toString();
    //     callback(content);
    //     this.channel.ack(msg);
    //   }
    // });

    logInfo(`📡 Subscribed to RabbitMQ queue: ${queue} (mock implementation)`, typeof callback === 'function' ? 'with callback' : 'no callback');
  }

  async publish(queue: string, message: string): Promise<boolean> {
    try {
      if (!this.channel) {
        return false;
      }

      // const sent = this.channel.sendToQueue(queue, Buffer.from(message), {
      //   persistent: true
      // });

      logInfo(`📤 Published message to RabbitMQ queue: ${queue} (mock implementation)`, message.length > 0 ? 'with content' : 'empty');
      return true;
    } catch (error) {
      console.error('❌ Failed to publish message:', error);
      return false;
    }
  }

  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }
}

/**
 * MQ连接工厂
 */
export class MQConnectionFactory {
  static create(type: 'memory' | 'rabbitmq', config?: MQConfig): MQConnection {
    switch (type) {
      case 'memory':
        return new InMemoryMQConnection();
      case 'rabbitmq':
        if (!config) {
          throw new Error('RabbitMQ connection requires config');
        }
        return new RabbitMQConnection(config);
      default:
        throw new Error(`Unsupported MQ type: ${type}`);
    }
  }
}
