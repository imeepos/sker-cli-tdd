/**
 * 🤖 AI联网查询综合示例
 * 演示AI如何使用网络请求工具获取实时信息并进行智能分析
 */

import { FetchToolsProvider } from '../src/fetch-tools';
import { CommandToolsProvider } from '../src/command-tools';
import { MCPServer } from '../src/mcp-server';
import { MCPWorkspaceManager } from '../src/mcp-workspace';
import { ToolManager } from '../src/tool-manager';

/**
 * AI助手类 - 模拟AI如何使用工具
 */
class AIAssistant {
  private toolManager: ToolManager;

  constructor(toolManager: ToolManager) {
    this.toolManager = toolManager;
  }

  /**
   * 查询GitHub项目信息并分析
   */
  async analyzeGitHubProject(owner: string, repo: string): Promise<void> {
    console.log(`🔍 正在分析GitHub项目: ${owner}/${repo}...`);
    
    try {
      const result = await this.toolManager.executeTool('fetch_json', {
        url: `https://api.github.com/repos/${owner}/${repo}`
      }) as any;

      if (result.success && result.data) {
        const data = result.data;
        console.log(`✅ 项目分析完成:`);
        console.log(`   📦 项目名称: ${data.name}`);
        console.log(`   📝 描述: ${data.description}`);
        console.log(`   ⭐ 星标数: ${data.stargazers_count?.toLocaleString()}`);
        console.log(`   🍴 Fork数: ${data.forks_count?.toLocaleString()}`);
        console.log(`   📊 主要语言: ${data.language}`);
        console.log(`   📅 创建时间: ${new Date(data.created_at).toLocaleDateString()}`);
        console.log(`   🔄 最后更新: ${new Date(data.updated_at).toLocaleDateString()}`);
        console.log(`   📋 开放问题: ${data.open_issues_count}`);
        
        // 分析项目活跃度
        const lastUpdate = new Date(data.updated_at);
        const daysSinceUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceUpdate < 7) {
          console.log(`   🔥 项目状态: 非常活跃 (${daysSinceUpdate}天前更新)`);
        } else if (daysSinceUpdate < 30) {
          console.log(`   ✅ 项目状态: 活跃 (${daysSinceUpdate}天前更新)`);
        } else {
          console.log(`   ⚠️ 项目状态: 较少更新 (${daysSinceUpdate}天前更新)`);
        }
      } else {
        console.log(`❌ 无法获取项目信息: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ 分析失败: ${(error as Error).message}`);
    }
  }

  /**
   * 获取天气信息并提供建议
   */
  async getWeatherAdvice(city: string, lat: number, lon: number): Promise<void> {
    console.log(`🌤️ 正在获取${city}的天气信息...`);
    
    try {
      const result = await this.toolManager.executeTool('fetch_json', {
        url: `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
      }) as any;

      if (result.success && result.data) {
        const current = result.data.current_weather;
        const daily = result.data.daily;
        
        console.log(`✅ ${city}天气信息:`);
        console.log(`   🌡️ 当前温度: ${current.temperature}°C`);
        console.log(`   💨 风速: ${current.windspeed} km/h`);
        console.log(`   📅 更新时间: ${new Date(current.time).toLocaleString()}`);
        
        if (daily) {
          console.log(`   📊 今日温度范围: ${daily.temperature_2m_min[0]}°C - ${daily.temperature_2m_max[0]}°C`);
          console.log(`   🌧️ 今日降水量: ${daily.precipitation_sum[0]}mm`);
        }

        // 提供天气建议
        const temp = current.temperature;
        const windspeed = current.windspeed;
        
        console.log(`   💡 出行建议:`);
        if (temp < 0) {
          console.log(`     ❄️ 天气寒冷，注意保暖，穿厚外套`);
        } else if (temp < 10) {
          console.log(`     🧥 天气较冷，建议穿外套`);
        } else if (temp < 25) {
          console.log(`     👕 天气舒适，适合外出活动`);
        } else {
          console.log(`     ☀️ 天气炎热，注意防晒和补水`);
        }
        
        if (windspeed > 20) {
          console.log(`     💨 风力较大，外出注意安全`);
        }
      } else {
        console.log(`❌ 无法获取天气信息: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ 天气查询失败: ${(error as Error).message}`);
    }
  }

  /**
   * 获取技术新闻并总结
   */
  async getTechNews(): Promise<void> {
    console.log(`📰 正在获取技术新闻...`);
    
    try {
      // 使用Hacker News API获取热门技术新闻
      const result = await this.toolManager.executeTool('fetch_json', {
        url: 'https://hacker-news.firebaseio.com/v0/topstories.json'
      }) as any;

      if (result.success && result.data && Array.isArray(result.data)) {
        console.log(`✅ 获取到${result.data.length}条热门新闻`);
        
        // 获取前5条新闻的详细信息
        console.log(`📋 热门技术新闻TOP5:`);
        
        for (let i = 0; i < Math.min(5, result.data.length); i++) {
          const storyId = result.data[i];
          const storyResult = await this.toolManager.executeTool('fetch_json', {
            url: `https://hacker-news.firebaseio.com/v0/item/${storyId}.json`
          }) as any;
          
          if (storyResult.success && storyResult.data) {
            const story = storyResult.data;
            console.log(`   ${i + 1}. ${story.title}`);
            console.log(`      👍 评分: ${story.score} | 💬 评论: ${story.descendants || 0}`);
            if (story.url) {
              console.log(`      🔗 链接: ${story.url}`);
            }
            console.log('');
          }
        }
      } else {
        console.log(`❌ 无法获取新闻: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ 新闻获取失败: ${(error as Error).message}`);
    }
  }

  /**
   * 检查网站状态
   */
  async checkWebsiteStatus(url: string): Promise<void> {
    console.log(`🔍 正在检查网站状态: ${url}...`);
    
    try {
      const result = await this.toolManager.executeTool('fetch_url', {
        url: url,
        timeout: 5000
      }) as any;

      console.log(`✅ 网站状态检查结果:`);
      console.log(`   🌐 URL: ${url}`);
      console.log(`   📊 状态码: ${result.status}`);
      console.log(`   📝 状态文本: ${result.statusText}`);
      console.log(`   ⏱️ 响应时间: ${result.responseTime}ms`);
      console.log(`   ✅ 可访问性: ${result.success ? '正常' : '异常'}`);
      
      if (result.responseTime) {
        if (result.responseTime < 500) {
          console.log(`   🚀 响应速度: 很快`);
        } else if (result.responseTime < 2000) {
          console.log(`   ⚡ 响应速度: 正常`);
        } else {
          console.log(`   🐌 响应速度: 较慢`);
        }
      }
    } catch (error) {
      console.error(`❌ 状态检查失败: ${(error as Error).message}`);
    }
  }
}

/**
 * 主函数 - 运行AI联网查询示例
 */
export async function runAIInternetExample(): Promise<void> {
  console.log('🤖 AI联网查询综合示例');
  console.log('=' .repeat(60));

  // 创建必要的组件
  const server = new MCPServer();
  const workspaceManager = new MCPWorkspaceManager();
  const toolManager = new ToolManager(server, workspaceManager);
  
  // 注册工具
  const fetchToolsProvider = new FetchToolsProvider();
  const commandToolsProvider = new CommandToolsProvider();
  toolManager.registerToolProvider(fetchToolsProvider);
  toolManager.registerToolProvider(commandToolsProvider);

  // 创建AI助手
  const ai = new AIAssistant(toolManager);

  try {
    // 1. 分析热门开源项目
    await ai.analyzeGitHubProject('microsoft', 'typescript');
    console.log('\n' + '-'.repeat(60) + '\n');

    // 2. 获取天气信息和建议
    await ai.getWeatherAdvice('北京', 39.9042, 116.4074);
    console.log('\n' + '-'.repeat(60) + '\n');

    // 3. 获取技术新闻
    await ai.getTechNews();
    console.log('\n' + '-'.repeat(60) + '\n');

    // 4. 检查网站状态
    await ai.checkWebsiteStatus('https://github.com');
    
  } catch (error) {
    console.error(`❌ 示例执行失败: ${(error as Error).message}`);
  }

  console.log('\n✅ AI联网查询示例完成！');
  console.log('🎉 AI现在具备了强大的联网查询和分析能力！');
  console.log('=' .repeat(60));
}

// 如果直接运行此文件
if (require.main === module) {
  runAIInternetExample().catch(console.error);
}
