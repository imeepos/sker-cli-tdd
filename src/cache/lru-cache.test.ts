/**
 * 🔴 TDD 红阶段：LRU缓存测试文件
 * 测试内存限制和淘汰策略、缓存命中率统计、序列化存储支持
 */

import { LRUCache, LRUCacheConfig } from './lru-cache';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('LRU Cache LRU缓存', () => {
  let cache: LRUCache<string, string>;
  let tempFile: string;

  beforeEach(() => {
    tempFile = path.join(os.tmpdir(), `lru-cache-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`);
  });

  afterEach(async () => {
    if (cache) {
      await cache.destroy(); // 使用destroy清理所有资源
    }
    
    // 清理临时文件
    try {
      if (fs.existsSync(tempFile)) {
        await fs.promises.unlink(tempFile);
      }
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('缓存初始化和基础操作', () => {
    it('应该能够创建LRU缓存实例', () => {
      cache = new LRUCache<string, string>({ maxSize: 5 });
      
      expect(cache).toBeDefined();
      expect(cache.size).toBe(0);
      expect(cache.maxSize).toBe(5);
    });

    it('应该能够设置和获取缓存项', () => {
      cache = new LRUCache<string, string>({ maxSize: 5 });
      
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      expect(cache.size).toBe(1);
    });

    it('应该在获取不存在的键时返回undefined', () => {
      cache = new LRUCache<string, string>({ maxSize: 5 });
      
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('应该能够检查键是否存在', () => {
      cache = new LRUCache<string, string>({ maxSize: 5 });
      
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('应该能够删除缓存项', () => {
      cache = new LRUCache<string, string>({ maxSize: 5 });
      
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      
      cache.delete('key1');
      expect(cache.has('key1')).toBe(false);
      expect(cache.size).toBe(0);
    });

    it('应该能够清空所有缓存项', async () => {
      cache = new LRUCache<string, string>({ maxSize: 5 });
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);
      
      await cache.clear();
      expect(cache.size).toBe(0);
    });
  });

  describe('LRU 淘汰策略', () => {
    it('应该在达到最大容量时淘汰最久未使用的项', () => {
      cache = new LRUCache<string, string>({ maxSize: 3 });
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      expect(cache.size).toBe(3);
      
      // 添加第4个项，应该淘汰key1
      cache.set('key4', 'value4');
      expect(cache.size).toBe(3);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('应该在访问时更新项的使用时间', () => {
      cache = new LRUCache<string, string>({ maxSize: 3 });
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // 访问key1，使其变为最近使用
      cache.get('key1');
      
      // 添加第4个项，应该淘汰key2（最久未访问）
      cache.set('key4', 'value4');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('应该在设置已存在键时更新值和使用时间', () => {
      cache = new LRUCache<string, string>({ maxSize: 3 });
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // 更新key1的值
      cache.set('key1', 'updated_value1');
      expect(cache.get('key1')).toBe('updated_value1');
      expect(cache.size).toBe(3);
      
      // 添加第4个项，应该淘汰key2（最久未访问）
      cache.set('key4', 'value4');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('内存限制和大小计算', () => {
    it('应该能够配置基于内存大小的限制', () => {
      const config: LRUCacheConfig = {
        maxSize: 1000,
        maxMemoryBytes: 1024 * 1024, // 1MB
        estimateSize: (key: string, value: string) => {
          return (key.length + value.length) * 2; // 简单估算
        }
      };
      
      cache = new LRUCache<string, string>(config);
      expect(cache.maxMemoryBytes).toBe(1024 * 1024);
    });

    it('应该在超出内存限制时进行淘汰', () => {
      const config: LRUCacheConfig = {
        maxSize: 100,
        maxMemoryBytes: 50, // 50 bytes - 更小的限制
        estimateSize: (key: string, value: string) => {
          return key.length + value.length; // 每个字符1字节
        }
      };
      
      cache = new LRUCache<string, string>(config);
      
      // 添加一些小项
      cache.set('a', 'b'); // 2 bytes
      cache.set('c', 'd'); // 2 bytes  
      cache.set('e', 'f'); // 2 bytes
      
      expect(cache.currentMemoryUsage).toBe(6); // 验证当前使用量
      
      // 添加一个大项，应该触发淘汰
      cache.set('large_key', 'this_is_a_very_long_value_string'); // ~40+ bytes
      expect(cache.currentMemoryUsage).toBeLessThanOrEqual(50);
    });
  });

  describe('缓存统计信息', () => {
    it('应该提供详细的缓存统计信息', () => {
      cache = new LRUCache<string, string>({ maxSize: 5 });
      
      cache.set('key1', 'value1');
      cache.get('key1'); // 命中
      cache.get('key2'); // 未命中
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
      expect(stats.deletes).toBe(0);
      expect(stats.evictions).toBe(0);
      expect(stats.hitRate).toBe(0.5); // 1/(1+1)
    });

    it('应该统计淘汰次数', () => {
      cache = new LRUCache<string, string>({ maxSize: 2 });
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3'); // 应该淘汰key1
      
      const stats = cache.getStats();
      expect(stats.evictions).toBe(1);
      expect(stats.currentSize).toBe(2);
    });

    it('应该能够重置统计信息', () => {
      cache = new LRUCache<string, string>({ maxSize: 5 });
      
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key2');
      
      let stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      
      cache.resetStats();
      
      stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('序列化存储支持', () => {
    it('应该能够将缓存内容序列化到文件', async () => {
      cache = new LRUCache<string, string>({ 
        maxSize: 5,
        persistFile: tempFile
      });
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      await cache.persist();
      
      expect(fs.existsSync(tempFile)).toBe(true);
      
      const fileContent = await fs.promises.readFile(tempFile, 'utf8');
      const data = JSON.parse(fileContent);
      
      expect(data.entries).toBeDefined();
      expect(data.entries.length).toBe(2);
      expect(data.config).toBeDefined();
    });

    it('应该能够从文件中加载缓存内容', async () => {
      // 先创建并持久化缓存
      cache = new LRUCache<string, string>({ 
        maxSize: 5,
        persistFile: tempFile
      });
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      await cache.persist();
      
      // 创建新的缓存实例并加载
      const newCache = new LRUCache<string, string>({ 
        maxSize: 5,
        persistFile: tempFile
      });
      
      await newCache.load();
      
      expect(newCache.size).toBe(2);
      expect(newCache.get('key1')).toBe('value1');
      expect(newCache.get('key2')).toBe('value2');
    });

    it('应该能够自动持久化缓存', async () => {
      cache = new LRUCache<string, string>({ 
        maxSize: 5,
        persistFile: tempFile,
        autoPersist: true,
        persistInterval: 100 // 100ms
      });
      
      cache.set('key1', 'value1');
      
      // 等待自动持久化
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(fs.existsSync(tempFile)).toBe(true);
    });

    it('应该处理加载时的文件错误', async () => {
      const nonExistentFile = '/nonexistent/path/cache.json';
      
      cache = new LRUCache<string, string>({ 
        maxSize: 5,
        persistFile: nonExistentFile
      });
      
      // 加载不存在的文件应该不抛出错误
      await expect(cache.load()).resolves.not.toThrow();
      expect(cache.size).toBe(0);
    });
  });

  describe('高级功能', () => {
    it('应该支持自定义键值序列化器', async () => {
      interface TestObject {
        id: number;
        name: string;
      }

      const config: LRUCacheConfig = {
        maxSize: 5,
        persistFile: tempFile,
        serializer: {
          serialize: (_key: string, value: TestObject) => JSON.stringify(value),
          deserialize: (_key: string, data: string) => JSON.parse(data) as TestObject
        }
      };

      const objectCache = new LRUCache<string, TestObject>(config);
      
      const obj1: TestObject = { id: 1, name: 'test1' };
      const obj2: TestObject = { id: 2, name: 'test2' };
      
      objectCache.set('obj1', obj1);
      objectCache.set('obj2', obj2);
      
      await objectCache.persist();
      
      // 创建新缓存并加载
      const newObjectCache = new LRUCache<string, TestObject>(config);
      await newObjectCache.load();
      
      const loadedObj1 = newObjectCache.get('obj1');
      expect(loadedObj1).toEqual(obj1);
      expect(loadedObj1?.id).toBe(1);
      expect(loadedObj1?.name).toBe('test1');
    });

    it('应该支持TTL过期机制', () => {
      cache = new LRUCache<string, string>({ 
        maxSize: 5,
        defaultTTL: 100 // 100ms
      });
      
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      
      // 等待TTL过期
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(cache.get('key1')).toBeUndefined();
          expect(cache.size).toBe(0);
          resolve();
        }, 150);
      });
    });

    it('应该能够设置单独的TTL', () => {
      cache = new LRUCache<string, string>({ maxSize: 5 });
      
      cache.set('key1', 'value1', { ttl: 100 });
      cache.set('key2', 'value2'); // 无TTL
      
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      
      // 等待key1过期
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(cache.get('key1')).toBeUndefined();
          expect(cache.get('key2')).toBe('value2');
          expect(cache.size).toBe(1);
          resolve();
        }, 150);
      });
    });

    it('应该能够获取所有键和值', () => {
      cache = new LRUCache<string, string>({ maxSize: 5 });
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      const keys = cache.keys();
      const values = cache.values();
      const entries = cache.entries();
      
      expect(keys).toHaveLength(3);
      expect(values).toHaveLength(3);
      expect(entries).toHaveLength(3);
      
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
      
      expect(values).toContain('value1');
      expect(values).toContain('value2');
      expect(values).toContain('value3');
    });
  });

  describe('并发和性能', () => {
    it('应该能够处理大量并发操作', () => {
      cache = new LRUCache<string, string>({ maxSize: 1000 });
      
      // 并发设置大量数据
      const promises = [];
      for (let i = 0; i < 500; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            cache.set(`key${i}`, `value${i}`);
            resolve();
          })
        );
      }
      
      return Promise.all(promises).then(() => {
        expect(cache.size).toBe(500);
        
        // 验证数据完整性
        for (let i = 0; i < 100; i++) {
          const randomIndex = Math.floor(Math.random() * 500);
          expect(cache.get(`key${randomIndex}`)).toBe(`value${randomIndex}`);
        }
      });
    });

    it('应该在高频操作下保持性能', () => {
      cache = new LRUCache<string, string>({ maxSize: 1000 });
      
      const startTime = Date.now();
      
      // 执行大量操作
      for (let i = 0; i < 10000; i++) {
        cache.set(`key${i % 1000}`, `value${i}`);
        if (i % 10 === 0) {
          cache.get(`key${i % 1000}`);
        }
      }
      
      const endTime = Date.now();
      const elapsed = endTime - startTime;
      
      // 10000次操作应该在合理时间内完成
      expect(elapsed).toBeLessThan(1000); // 1秒
      expect(cache.size).toBe(1000);
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的配置参数', () => {
      expect(() => {
        new LRUCache<string, string>({ maxSize: 0 });
      }).toThrow('最大大小必须大于0');
      
      expect(() => {
        new LRUCache<string, string>({ maxSize: -1 });
      }).toThrow('最大大小必须大于0');
    });

    it('应该处理序列化错误', async () => {
      const config: LRUCacheConfig = {
        maxSize: 5,
        persistFile: tempFile,
        serializer: {
          serialize: () => {
            throw new Error('序列化错误');
          },
          deserialize: (_key: string, data: string) => data
        }
      };

      cache = new LRUCache<string, string>(config);
      cache.set('key1', 'value1');
      
      // 持久化时的序列化错误应该被处理
      await expect(cache.persist()).rejects.toThrow('序列化错误');
    });

    it('应该处理文件写入权限错误', async () => {
      // 使用只读目录测试写入权限错误
      const readOnlyFile = process.platform === 'win32' 
        ? 'C:\\Windows\\System32\\readonly-cache.json'
        : '/etc/readonly-cache.json';
      
      cache = new LRUCache<string, string>({ 
        maxSize: 5,
        persistFile: readOnlyFile
      });
      
      cache.set('key1', 'value1');
      
      // 写入只读位置应该失败
      await expect(cache.persist()).rejects.toThrow();
    });
  });
});