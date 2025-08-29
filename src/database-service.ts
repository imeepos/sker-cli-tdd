/**
 * 通用LevelDB数据库服务
 * 提供基础的数据库操作功能
 */

import { Level } from 'level';
import path from 'path';
import os from 'os';

export interface DatabaseConfig {
  dbPath?: string;
  sublevels?: string[];
}

/**
 * 数据库服务基类
 */
export class DatabaseService {
  protected db: Level<string, string>;
  protected sublevels: Map<string, any> = new Map();
  
  constructor(config: DatabaseConfig = {}) {
    const defaultPath = path.join(os.homedir(), '.sker-ai', 'db');
    const actualPath = config.dbPath || defaultPath;
    
    this.db = new Level(actualPath);
    
    // 初始化子级数据库
    if (config.sublevels) {
      config.sublevels.forEach(name => {
        this.sublevels.set(name, this.db.sublevel(name, { valueEncoding: 'json' }));
      });
    }
  }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    await this.db.open();
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    await this.db.close();
  }

  /**
   * 获取子级数据库
   */
  protected getSublevel(name: string): any {
    return this.sublevels.get(name);
  }

  /**
   * 添加子级数据库
   */
  protected addSublevel(name: string): any {
    if (!this.sublevels.has(name)) {
      const sublevel = this.db.sublevel(name, { valueEncoding: 'json' });
      this.sublevels.set(name, sublevel);
      return sublevel;
    }
    return this.sublevels.get(name);
  }

  /**
   * 生成唯一ID
   */
  protected generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清空所有数据
   */
  async clearAll(): Promise<void> {
    for (const [, sublevel] of this.sublevels) {
      await sublevel.clear();
    }
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{ [sublevelName: string]: number }> {
    const stats: { [sublevelName: string]: number } = {};
    
    for (const [name, sublevel] of this.sublevels) {
      let count = 0;
      for await (const [] of sublevel.iterator({ values: false })) {
        count++;
      }
      stats[name] = count;
    }
    
    return stats;
  }
}