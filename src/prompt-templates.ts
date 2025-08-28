/**
 * 🔄 TDD 重构阶段：常用提示词模板提供者
 * 提供一系列预定义的常用提示词模板
 * 遵循单一职责原则：专门负责提供提示词模板
 */

import { MCPPromptManager } from './mcp-prompts';

/**
 * 提示词模板提供者
 * 负责创建和管理常用的提示词模板
 */
export class PromptTemplatesProvider {
  private readonly promptManager: MCPPromptManager;

  constructor(promptManager: MCPPromptManager) {
    this.promptManager = promptManager;
  }

  /**
   * 注册所有预定义的提示词模板
   */
  registerAllTemplates(): void {
    this.registerCodingTemplates();
    this.registerWritingTemplates();
    this.registerAnalysisTemplates();
    this.registerEducationTemplates();
  }

  /**
   * 注册编程相关的提示词模板
   */
  registerCodingTemplates(): void {
    // 代码审查提示词
    this.promptManager.registerPrompt({
      name: 'code-review',
      description: '代码审查提示词',
      template: `请对以下 {{language}} 代码进行详细审查：

代码：
\`\`\`{{language}}
{{code}}
\`\`\`

请从以下方面进行评估：
1. 代码质量和可读性
2. 性能优化建议
3. 安全性考虑
4. 最佳实践遵循情况
5. 潜在的 bug 或问题

审查重点：{{focus}}`,
      arguments: [
        {
          name: 'language',
          description: '编程语言',
          required: true
        },
        {
          name: 'code',
          description: '要审查的代码',
          required: true
        },
        {
          name: 'focus',
          description: '审查重点',
          required: false,
          default: '代码质量和性能'
        }
      ]
    });

    // 代码解释提示词
    this.promptManager.registerPrompt({
      name: 'code-explain',
      description: '代码解释提示词',
      template: `请详细解释以下 {{language}} 代码的功能和工作原理：

\`\`\`{{language}}
{{code}}
\`\`\`

请包括：
1. 代码的主要功能
2. 关键算法或逻辑
3. 重要的设计模式或技术
4. 代码的执行流程

解释级别：{{level}}`,
      arguments: [
        {
          name: 'language',
          description: '编程语言',
          required: true
        },
        {
          name: 'code',
          description: '要解释的代码',
          required: true
        },
        {
          name: 'level',
          description: '解释详细程度',
          required: false,
          default: '中等详细'
        }
      ]
    });

    // 代码重构提示词
    this.promptManager.registerPrompt({
      name: 'code-refactor',
      description: '代码重构建议提示词',
      template: `请为以下 {{language}} 代码提供重构建议：

当前代码：
\`\`\`{{language}}
{{code}}
\`\`\`

重构目标：{{goal}}

请提供：
1. 具体的重构建议
2. 重构后的代码示例
3. 重构的好处和理由
4. 需要注意的风险点`,
      arguments: [
        {
          name: 'language',
          description: '编程语言',
          required: true
        },
        {
          name: 'code',
          description: '要重构的代码',
          required: true
        },
        {
          name: 'goal',
          description: '重构目标',
          required: false,
          default: '提高代码质量和可维护性'
        }
      ]
    });
  }

  /**
   * 注册写作相关的提示词模板
   */
  registerWritingTemplates(): void {
    // 文档写作提示词
    this.promptManager.registerPrompt({
      name: 'documentation',
      description: '技术文档写作提示词',
      template: `请为 {{project}} 项目编写 {{type}} 文档：

项目描述：{{description}}

文档要求：
- 目标读者：{{audience}}
- 详细程度：{{detail_level}}
- 包含示例：{{include_examples}}

请确保文档结构清晰，内容准确，易于理解。`,
      arguments: [
        {
          name: 'project',
          description: '项目名称',
          required: true
        },
        {
          name: 'type',
          description: '文档类型',
          required: true
        },
        {
          name: 'description',
          description: '项目描述',
          required: true
        },
        {
          name: 'audience',
          description: '目标读者',
          required: false,
          default: '开发者'
        },
        {
          name: 'detail_level',
          description: '详细程度',
          required: false,
          default: '详细'
        },
        {
          name: 'include_examples',
          description: '是否包含示例',
          required: false,
          default: '是'
        }
      ]
    });
  }

  /**
   * 注册分析相关的提示词模板
   */
  registerAnalysisTemplates(): void {
    // 需求分析提示词
    this.promptManager.registerPrompt({
      name: 'requirement-analysis',
      description: '需求分析提示词',
      template: `请对以下项目需求进行详细分析：

项目名称：{{project_name}}
需求描述：{{requirements}}

分析维度：
1. 功能需求分析
2. 非功能需求识别
3. 技术可行性评估
4. 风险评估
5. 实现建议

分析重点：{{focus_area}}
项目规模：{{project_scale}}`,
      arguments: [
        {
          name: 'project_name',
          description: '项目名称',
          required: true
        },
        {
          name: 'requirements',
          description: '需求描述',
          required: true
        },
        {
          name: 'focus_area',
          description: '分析重点',
          required: false,
          default: '功能完整性和技术可行性'
        },
        {
          name: 'project_scale',
          description: '项目规模',
          required: false,
          default: '中等规模'
        }
      ]
    });
  }

  /**
   * 注册教育相关的提示词模板
   */
  registerEducationTemplates(): void {
    // 学习计划提示词
    this.promptManager.registerPrompt({
      name: 'learning-plan',
      description: '学习计划制定提示词',
      template: `请为学习 {{subject}} 制定一个详细的学习计划：

学习者背景：
- 当前水平：{{current_level}}
- 目标水平：{{target_level}}
- 可用时间：{{available_time}}
- 学习偏好：{{learning_style}}

请提供：
1. 分阶段的学习路径
2. 每个阶段的学习目标
3. 推荐的学习资源
4. 实践项目建议
5. 进度评估方法

特殊要求：{{special_requirements}}`,
      arguments: [
        {
          name: 'subject',
          description: '学习主题',
          required: true
        },
        {
          name: 'current_level',
          description: '当前水平',
          required: true
        },
        {
          name: 'target_level',
          description: '目标水平',
          required: true
        },
        {
          name: 'available_time',
          description: '可用学习时间',
          required: false,
          default: '每天1-2小时'
        },
        {
          name: 'learning_style',
          description: '学习偏好',
          required: false,
          default: '理论结合实践'
        },
        {
          name: 'special_requirements',
          description: '特殊要求',
          required: false,
          default: '无'
        }
      ]
    });
  }
}
