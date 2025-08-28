/**
 * 🔄 TDD 重构阶段：MCP OpenAI 集成使用示例
 * 展示如何将 MCP 服务器与 OpenAI API 集成
 */

import { MCPServer } from './mcp-server';
import { MCPWorkspaceManager } from './mcp-workspace';
import { MCPPromptManager } from './mcp-prompts';
import { PromptTemplatesProvider } from './prompt-templates';
import { MCPOpenAIClient, MCPOpenAIConfig } from './mcp-openai';
import { CalculatorToolsProvider } from './calculator-tools';

/**
 * 运行 MCP OpenAI 集成示例
 */
export async function runMCPOpenAIExample(): Promise<void> {
  console.log('🚀 启动 MCP OpenAI 集成示例...\n');

  try {
    // 1. 创建 MCP 服务器和管理器
    console.log('📋 创建 MCP 服务器和管理器...');
    const server = new MCPServer();
    const workspaceManager = new MCPWorkspaceManager();
    const promptManager = new MCPPromptManager();
    
    // 集成管理器到服务器
    server.setWorkspaceManager(workspaceManager);
    server.setPromptManager(promptManager);
    
    console.log('✅ 服务器和管理器创建完成');

    // 2. 注册工具和提示词
    console.log('\n🔧 注册工具和提示词...');
    
    // 注册计算器工具
    const calculatorProvider = new CalculatorToolsProvider();
    const calculatorTools = calculatorProvider.getTools();
    calculatorTools.forEach(tool => server.registerTool(tool));

    // 注册预定义提示词模板
    new PromptTemplatesProvider(promptManager);
    // 模板已在构造函数中注册
    
    console.log('✅ 工具和提示词注册完成');

    // 3. 创建 OpenAI 客户端
    console.log('\n🤖 创建 OpenAI 客户端...');
    
    // 从环境变量加载配置（如果存在）
    let openaiConfig: MCPOpenAIConfig;
    try {
      openaiConfig = MCPOpenAIClient.loadConfigFromEnv();
      console.log('✅ 从环境变量加载 OpenAI 配置');
    } catch (error) {
      // 使用测试配置
      openaiConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
        maxTokens: 1000,
        temperature: 0.7
      };
      console.log('⚠️  使用测试配置（请设置 OPENAI_API_KEY 环境变量）');
    }
    
    const openaiClient = new MCPOpenAIClient(openaiConfig, server);
    console.log(`📝 模型: ${openaiConfig.model}`);
    console.log(`🎛️  温度: ${openaiConfig.temperature || 0.7}`);

    // 4. 展示工具转换
    console.log('\n🔄 展示 MCP 工具转换为 OpenAI 函数格式...');
    const openaiTools = openaiClient.getOpenAITools();
    console.log(`📊 可用工具数量: ${openaiTools.length}`);
    
    openaiTools.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.function.name}: ${tool.function.description}`);
    });

    // 5. 模拟聊天对话（使用 Mock 数据）
    console.log('\n💬 模拟聊天对话...');
    
    // 模拟用户消息
    const userMessages = [
      { role: 'user' as const, content: '你好！请帮我计算 15 + 27' },
      { role: 'user' as const, content: '请用编程助手的身份介绍一下自己' }
    ];

    for (const [index, message] of userMessages.entries()) {
      console.log(`\n📤 用户消息 ${index + 1}: ${message.content}`);
      
      try {
        // 注意：这里会因为没有真实的 API 密钥而失败，但展示了使用方法
        if (openaiConfig.apiKey === 'test-api-key') {
          console.log('🔧 模拟 OpenAI 响应（测试模式）');
          
          if (message.content.includes('计算')) {
            console.log('🤖 AI: 我来帮你计算 15 + 27');
            console.log('🔧 调用工具: add(15, 27)');
            console.log('📊 工具结果: 42');
            console.log('🤖 AI: 15 + 27 = 42');
          } else if (message.content.includes('编程助手')) {
            console.log('🤖 AI: 你好！我是一名专业的编程助手，擅长帮助开发者解决编程问题...');
          }
        } else {
          // 真实的 API 调用
          const response = await openaiClient.chatCompletionWithTools([message]);
          console.log(`🤖 AI: ${response.choices[0]?.message?.content || '无响应'}`);
          
          // 处理工具调用
          const toolCalls = response.choices[0]?.message?.tool_calls;
          if (toolCalls && toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
              const result = await openaiClient.executeToolCall(toolCall);
              console.log(`🔧 工具调用结果: ${result.content}`);
            }
          }
        }
      } catch (error) {
        console.log(`❌ API 调用失败: ${(error as Error).message}`);
        console.log('💡 提示: 请设置正确的 OPENAI_API_KEY 环境变量');
      }
    }

    // 6. 展示提示词集成
    console.log('\n📝 展示提示词集成...');
    
    try {
      // 使用预定义的编程助手提示词
      const promptName = 'programming-assistant';
      const promptArgs = {
        language: 'TypeScript',
        task: '代码审查和优化建议'
      };
      
      console.log(`🎯 使用提示词: ${promptName}`);
      console.log(`📋 参数: ${JSON.stringify(promptArgs, null, 2)}`);
      
      if (openaiConfig.apiKey === 'test-api-key') {
        console.log('🔧 模拟提示词渲染（测试模式）');
        console.log('📝 渲染结果: 你是一名专业的 TypeScript 编程助手，专门负责代码审查和优化建议...');
      } else {
        const response = await openaiClient.chatCompletionWithPrompt(
          promptName,
          promptArgs,
          [{ role: 'user', content: '请审查这段代码并给出优化建议' }]
        );
        console.log(`🤖 AI 响应: ${response.choices[0]?.message?.content || '无响应'}`);
      }
    } catch (error) {
      console.log(`❌ 提示词处理失败: ${(error as Error).message}`);
    }

    // 7. 展示工作空间集成
    console.log('\n🏗️ 展示工作空间集成...');
    
    // 创建项目工作空间
    workspaceManager.createWorkspace({
      id: 'ai-project',
      name: 'AI 项目',
      description: 'OpenAI 集成项目工作空间'
    });
    
    // 向项目工作空间添加特定工具
    workspaceManager.addToolToWorkspace('ai-project', {
      name: 'generate-code',
      description: '生成代码',
      schema: {
        type: 'object',
        properties: {
          language: { type: 'string', description: '编程语言' },
          description: { type: 'string', description: '代码描述' }
        },
        required: ['language', 'description']
      },
      handler: async (params) => ({
        code: `// ${params.description}\n// 使用 ${params.language} 实现\nconsole.log('Hello, World!');`,
        language: params.language
      })
    });
    
    // 切换到项目工作空间
    server.setCurrentWorkspace('ai-project');
    
    console.log(`📁 当前工作空间: ${server.getCurrentWorkspace()?.name}`);
    console.log(`🔧 可用工具数量: ${openaiClient.getOpenAITools().length}`);
    
    // 8. 展示完整对话流程
    console.log('\n🔄 展示完整对话流程（包含工具调用）...');
    
    if (openaiConfig.apiKey === 'test-api-key') {
      console.log('🔧 模拟完整对话流程（测试模式）');
      console.log('👤 用户: 请用 TypeScript 生成一个计算器类');
      console.log('🤖 AI: 我来为你生成一个 TypeScript 计算器类');
      console.log('🔧 调用工具: generate-code(language="TypeScript", description="计算器类")');
      console.log('📊 工具结果: 生成了计算器类代码');
      console.log('🤖 AI: 我已经为你生成了一个 TypeScript 计算器类...');
    } else {
      try {
        const conversation = await openaiClient.processConversation([
          { role: 'user', content: '请用 TypeScript 生成一个计算器类' }
        ]);
        
        console.log(`🔄 对话轮次: ${conversation.messages.length}`);
        console.log(`🔧 工具调用次数: ${conversation.toolCallsExecuted}`);
        console.log(`🤖 最终响应: ${conversation.finalResponse.choices[0]?.message?.content || '无响应'}`);
      } catch (error) {
        console.log(`❌ 对话处理失败: ${(error as Error).message}`);
      }
    }

    console.log('\n🎉 MCP OpenAI 集成示例完成！');
    console.log('\n📚 功能总结:');
    console.log('   ✅ OpenAI API 集成');
    console.log('   ✅ MCP 工具转换为 OpenAI 函数');
    console.log('   ✅ 工具调用执行');
    console.log('   ✅ 提示词模板集成');
    console.log('   ✅ 工作空间支持');
    console.log('   ✅ 完整对话流程');
    console.log('   ✅ 流式响应支持');
    console.log('   ✅ 环境变量配置');

  } catch (error) {
    console.error('❌ 示例运行失败:', error);
    throw error;
  }
}

/**
 * 运行 MCP OpenAI 流式输出示例
 * 展示如何使用流式响应功能
 */
export async function runMCPOpenAIStreamExample(): Promise<void> {
  console.log('🌊 启动 MCP OpenAI 流式输出示例...\n');

  try {
    // 1. 创建 MCP 服务器和 OpenAI 客户端
    console.log('📋 创建 MCP 服务器和 OpenAI 客户端...');
    const server = new MCPServer();
    const workspaceManager = new MCPWorkspaceManager();
    const promptManager = new MCPPromptManager();

    server.setWorkspaceManager(workspaceManager);
    server.setPromptManager(promptManager);

    // 注册计算器工具
    const calculatorProvider = new CalculatorToolsProvider();
    const calculatorTools = calculatorProvider.getTools();
    calculatorTools.forEach(tool => server.registerTool(tool));

    // 注册提示词模板
    new PromptTemplatesProvider(promptManager);

    // 创建 OpenAI 客户端
    let openaiConfig: MCPOpenAIConfig;
    try {
      openaiConfig = MCPOpenAIClient.loadConfigFromEnv();
      console.log('✅ 从环境变量加载 OpenAI 配置');
    } catch (error) {
      openaiConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
        maxTokens: 1000,
        temperature: 0.7
      };
      console.log('⚠️  使用测试配置（请设置 OPENAI_API_KEY 环境变量）');
    }

    const openaiClient = new MCPOpenAIClient(openaiConfig, server);
    console.log(`📝 模型: ${openaiConfig.model}`);

    // 2. 基础流式聊天示例
    console.log('\n🌊 示例 1: 基础流式聊天...');

    const messages = [
      { role: 'user' as const, content: '请用简洁的语言介绍一下人工智能的发展历程' }
    ];

    if (openaiConfig.apiKey === 'test-api-key') {
      console.log('🔧 模拟流式响应（测试模式）');
      console.log('🤖 AI 流式响应:');

      // 模拟流式输出
      const mockResponse = '人工智能发展历程可以分为几个重要阶段：\n\n1. **起源阶段（1950s-1960s）**\n   - 图灵测试提出\n   - 第一批AI程序诞生\n\n2. **专家系统时代（1970s-1980s）**\n   - 基于规则的系统\n   - 知识工程兴起\n\n3. **机器学习革命（1990s-2000s）**\n   - 统计学习方法\n   - 支持向量机、随机森林\n\n4. **深度学习时代（2010s-至今）**\n   - 神经网络复兴\n   - 大模型和生成式AI\n\n每个阶段都带来了技术突破和应用创新。';

      // 模拟逐字输出
      for (let i = 0; i < mockResponse.length; i++) {
        process.stdout.write(mockResponse[i] || '');
        await new Promise(resolve => setTimeout(resolve, 20)); // 模拟延迟
      }
      console.log('\n');
    } else {
      try {
        console.log('🤖 AI 流式响应:');
        const stream = await openaiClient.chatCompletionStream(messages);

        let fullResponse = '';
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            process.stdout.write(content);
            fullResponse += content;
          }
        }
        console.log('\n');
        console.log(`📊 完整响应长度: ${fullResponse.length} 字符`);
      } catch (error) {
        console.log(`❌ 流式聊天失败: ${(error as Error).message}`);
      }
    }

    // 3. 带工具调用的流式响应示例
    console.log('\n🔧 示例 2: 带工具调用的流式响应...');

    const toolMessages = [
      { role: 'user' as const, content: '请帮我计算 123 + 456，然后详细解释计算过程' }
    ];

    if (openaiConfig.apiKey === 'test-api-key') {
      console.log('🔧 模拟带工具调用的流式响应（测试模式）');
      console.log('🤖 AI: 我来帮您计算 123 + 456');
      console.log('🔧 调用工具: add(123, 456)');
      console.log('📊 工具结果: 579');
      console.log('🤖 AI 流式解释:');

      const explanation = '计算过程详解：\n\n**步骤 1: 理解问题**\n我需要计算两个数字的和：123 + 456\n\n**步骤 2: 调用计算工具**\n使用加法工具执行精确计算\n\n**步骤 3: 验证结果**\n123 + 456 = 579\n\n**计算验证:**\n- 个位数: 3 + 6 = 9\n- 十位数: 2 + 5 = 7  \n- 百位数: 1 + 4 = 5\n- 结果: 579 ✓\n\n这个结果是正确的！';

      for (let i = 0; i < explanation.length; i++) {
        process.stdout.write(explanation[i] || '');
        await new Promise(resolve => setTimeout(resolve, 15));
      }
      console.log('\n');
    } else {
      try {
        // 先进行带工具调用的聊天完成
        const toolResponse = await openaiClient.chatCompletionWithTools(toolMessages);
        const assistantMessage = toolResponse.choices[0]?.message;

        if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
          console.log('🔧 执行工具调用...');

          // 构建对话历史
          const conversationMessages: any[] = [...toolMessages, assistantMessage];

          // 执行工具调用
          for (const toolCall of assistantMessage.tool_calls) {
            const toolResult = await openaiClient.executeToolCall(toolCall);
            conversationMessages.push(toolResult);
            console.log(`📊 工具结果: ${toolResult.content}`);
          }

          // 添加请求详细解释的消息
          conversationMessages.push({
            role: 'user',
            content: '请详细解释这个计算过程'
          });

          // 流式获取解释
          console.log('🤖 AI 流式解释:');
          const explanationStream = await openaiClient.chatCompletionStream(conversationMessages);

          let explanationResponse = '';
          for await (const chunk of explanationStream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              process.stdout.write(content);
              explanationResponse += content;
            }
          }
          console.log('\n');
        }
      } catch (error) {
        console.log(`❌ 工具调用流式响应失败: ${(error as Error).message}`);
      }
    }

    // 4. 多轮对话流式示例
    console.log('\n💬 示例 3: 多轮对话流式响应...');

    const conversationTopics = [
      '什么是机器学习？',
      '请举个具体的应用例子',
      '这个技术有什么局限性吗？'
    ];

    if (openaiConfig.apiKey === 'test-api-key') {
      console.log('🔧 模拟多轮对话流式响应（测试模式）');

      const mockResponses = [
        '机器学习是人工智能的一个分支，它让计算机能够从数据中自动学习和改进，而无需明确编程。',
        '一个典型例子是推荐系统，比如Netflix根据您的观看历史推荐电影，或者Amazon根据购买记录推荐商品。',
        '主要局限性包括：需要大量高质量数据、可能存在偏见、缺乏可解释性、以及在处理全新情况时的泛化能力有限。'
      ];

      for (let i = 0; i < conversationTopics.length; i++) {
        console.log(`\n👤 用户: ${conversationTopics[i]}`);
        console.log('🤖 AI 流式回答:');

        const response = mockResponses[i];
        if (response) {
          for (let j = 0; j < response.length; j++) {
            process.stdout.write(response[j] || '');
            await new Promise(resolve => setTimeout(resolve, 25));
          }
        }
        console.log('\n');
      }
    } else {
      try {
        const conversationHistory: any[] = [];

        for (const topic of conversationTopics) {
          console.log(`\n👤 用户: ${topic}`);

          // 添加用户消息到对话历史
          conversationHistory.push({ role: 'user', content: topic });

          console.log('🤖 AI 流式回答:');
          const stream = await openaiClient.chatCompletionStream(conversationHistory);

          let assistantResponse = '';
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              process.stdout.write(content);
              assistantResponse += content;
            }
          }

          // 添加助手响应到对话历史
          conversationHistory.push({ role: 'assistant', content: assistantResponse });
          console.log('\n');
        }
      } catch (error) {
        console.log(`❌ 多轮对话流式响应失败: ${(error as Error).message}`);
      }
    }

    // 5. 自定义流式处理示例
    console.log('\n⚙️ 示例 4: 自定义流式处理...');

    if (openaiConfig.apiKey === 'test-api-key') {
      console.log('🔧 模拟自定义流式处理（测试模式）');

      const mockText = '这是一个展示自定义流式处理的示例。我们可以添加实时的字符统计、关键词高亮、以及进度显示等功能。';
      let charCount = 0;
      let wordCount = 0;

      console.log('🤖 AI 响应（带实时统计）:');
      console.log('┌─────────────────────────────────────────────┐');
      process.stdout.write('│ ');

      for (let i = 0; i < mockText.length; i++) {
        const char = mockText[i];
        process.stdout.write(char || '');
        charCount++;

        if (char === ' ' || char === '。' || char === '，') {
          wordCount++;
        }

        // 每20个字符显示一次统计
        if (charCount % 20 === 0) {
          process.stdout.write(`\n│ [字符: ${charCount}, 词数: ${wordCount}] `);
        }

        await new Promise(resolve => setTimeout(resolve, 30));
      }

      console.log('\n└─────────────────────────────────────────────┘');
      console.log(`📊 最终统计: ${charCount} 字符, ${wordCount} 词`);
    } else {
      try {
        const customMessages = [
          { role: 'user' as const, content: '请写一段关于编程的励志文字' }
        ];

        console.log('🤖 AI 响应（带实时统计）:');
        console.log('┌─────────────────────────────────────────────┐');
        process.stdout.write('│ ');

        const stream = await openaiClient.chatCompletionStream(customMessages);

        let charCount = 0;
        let wordCount = 0;
        let fullResponse = '';

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            process.stdout.write(content);
            fullResponse += content;
            charCount += content.length;

            // 简单的词数统计
            const words = content.split(/\s+/).filter(word => word.length > 0);
            wordCount += words.length;

            // 每50个字符显示一次统计
            if (charCount % 50 === 0) {
              process.stdout.write(`\n│ [字符: ${charCount}, 词数: ${wordCount}] `);
            }
          }
        }

        console.log('\n└─────────────────────────────────────────────┘');
        console.log(`📊 最终统计: ${charCount} 字符, ${wordCount} 词`);
      } catch (error) {
        console.log(`❌ 自定义流式处理失败: ${(error as Error).message}`);
      }
    }

    console.log('\n🎉 MCP OpenAI 流式输出示例完成！');
    console.log('\n📚 流式功能总结:');
    console.log('   ✅ 基础流式聊天');
    console.log('   ✅ 带工具调用的流式响应');
    console.log('   ✅ 多轮对话流式处理');
    console.log('   ✅ 自定义流式处理和统计');
    console.log('   ✅ 实时字符和词数统计');
    console.log('   ✅ 流式响应错误处理');

  } catch (error) {
    console.error('❌ 流式示例运行失败:', error);
    throw error;
  }
}

// 如果直接运行此文件
if (require.main === module) {
  // 检查命令行参数
  const args = process.argv.slice(2);
  if (args.includes('--stream')) {
    runMCPOpenAIStreamExample().catch(console.error);
  } else {
    runMCPOpenAIExample().catch(console.error);
  }
}
