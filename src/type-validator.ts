/**
 * 🟢 TDD 绿阶段：TypeValidator 运行时类型验证实现
 * 提供全面的运行时类型验证功能，减少any类型使用
 */

/**
 * 类型验证错误类
 * 继承自Error，提供更详细的验证错误信息
 */
export class ValidationError extends Error {
  public readonly fieldName: string;
  public readonly expectedType: string;
  public readonly actualType: string;

  constructor(fieldName: string, expectedType: string, actualType: string) {
    const message = `字段 ${fieldName} 应该是 ${expectedType} 类型，但收到了 ${actualType} 类型`;
    super(message);
    this.name = 'ValidationError';
    this.fieldName = fieldName;
    this.expectedType = expectedType;
    this.actualType = actualType;
  }
}

/**
 * 获取值的实际类型字符串
 * @param value 要检查的值
 * @returns 类型字符串
 */
function getActualType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * 类型验证器工具类
 * 提供运行时类型验证功能，确保数据类型安全
 */
export class TypeValidator {
  /**
   * 验证字符串类型
   * @param value 要验证的值
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果类型不匹配
   */
  static validateString(
    value: unknown,
    fieldName: string
  ): asserts value is string {
    if (typeof value !== 'string') {
      throw new ValidationError(fieldName, 'string', getActualType(value));
    }
  }

  /**
   * 验证数字类型
   * @param value 要验证的值
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果类型不匹配
   */
  static validateNumber(
    value: unknown,
    fieldName: string
  ): asserts value is number {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new ValidationError(fieldName, 'number', getActualType(value));
    }
  }

  /**
   * 验证布尔类型
   * @param value 要验证的值
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果类型不匹配
   */
  static validateBoolean(
    value: unknown,
    fieldName: string
  ): asserts value is boolean {
    if (typeof value !== 'boolean') {
      throw new ValidationError(fieldName, 'boolean', getActualType(value));
    }
  }

  /**
   * 验证数组类型
   * @param value 要验证的值
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果类型不匹配
   */
  static validateArray(
    value: unknown,
    fieldName: string
  ): asserts value is unknown[] {
    if (!Array.isArray(value)) {
      throw new ValidationError(fieldName, 'array', getActualType(value));
    }
  }

  /**
   * 验证对象类型（非null且非数组）
   * @param value 要验证的值
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果类型不匹配
   */
  static validateObject(
    value: unknown,
    fieldName: string
  ): asserts value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ValidationError(fieldName, 'object', getActualType(value));
    }
  }

  /**
   * 验证可选字符串类型
   * @param value 要验证的值
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果类型不匹配
   */
  static validateOptionalString(
    value: unknown,
    fieldName: string
  ): asserts value is string | undefined {
    if (value !== undefined && typeof value !== 'string') {
      throw new ValidationError(
        fieldName,
        'string | undefined',
        getActualType(value)
      );
    }
  }

  /**
   * 验证可选数字类型
   * @param value 要验证的值
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果类型不匹配
   */
  static validateOptionalNumber(
    value: unknown,
    fieldName: string
  ): asserts value is number | undefined {
    if (value !== undefined && (typeof value !== 'number' || isNaN(value))) {
      throw new ValidationError(
        fieldName,
        'number | undefined',
        getActualType(value)
      );
    }
  }

  /**
   * 验证可选对象类型
   * @param value 要验证的值
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果类型不匹配
   */
  static validateOptionalObject(
    value: unknown,
    fieldName: string
  ): asserts value is Record<string, unknown> | undefined {
    if (
      value !== undefined &&
      (typeof value !== 'object' || value === null || Array.isArray(value))
    ) {
      throw new ValidationError(
        fieldName,
        'object | undefined',
        getActualType(value)
      );
    }
  }

  /**
   * 验证枚举值
   * @param value 要验证的值
   * @param validValues 有效值数组
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果值不在枚举中
   */
  static validateEnum<T extends string>(
    value: unknown,
    validValues: readonly T[],
    fieldName: string
  ): asserts value is T {
    if (typeof value !== 'string' || !validValues.includes(value as T)) {
      throw new ValidationError(
        fieldName,
        `enum(${validValues.join('|')})`,
        getActualType(value)
      );
    }
  }

  /**
   * 验证对象Schema
   * @param value 要验证的对象
   * @param schema Schema定义
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果对象不符合Schema
   */
  static validateObjectSchema(
    value: unknown,
    schema: Record<string, string>,
    fieldName: string
  ): void {
    this.validateObject(value, fieldName);

    for (const [key, expectedType] of Object.entries(schema)) {
      const fieldValue = (value as Record<string, unknown>)[key];
      const fieldPath = `${fieldName}.${key}`;

      switch (expectedType) {
        case 'string':
          this.validateString(fieldValue, fieldPath);
          break;
        case 'number':
          this.validateNumber(fieldValue, fieldPath);
          break;
        case 'boolean':
          this.validateBoolean(fieldValue, fieldPath);
          break;
        case 'array':
          this.validateArray(fieldValue, fieldPath);
          break;
        case 'object':
          this.validateObject(fieldValue, fieldPath);
          break;
        default:
          throw new ValidationError(
            fieldPath,
            expectedType,
            getActualType(fieldValue)
          );
      }
    }
  }

  /**
   * 验证数组元素类型
   * @param value 要验证的数组
   * @param elementType 元素期望类型
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果数组元素类型不匹配
   */
  static validateArrayOfType(
    value: unknown,
    elementType: string,
    fieldName: string
  ): void {
    this.validateArray(value, fieldName);

    (value as unknown[]).forEach((element, index) => {
      const elementPath = `${fieldName}[${index}]`;

      switch (elementType) {
        case 'string':
          this.validateString(element, elementPath);
          break;
        case 'number':
          this.validateNumber(element, elementPath);
          break;
        case 'boolean':
          this.validateBoolean(element, elementPath);
          break;
        case 'object':
          this.validateObject(element, elementPath);
          break;
        default:
          if (typeof element !== elementType) {
            throw new ValidationError(
              elementPath,
              elementType,
              getActualType(element)
            );
          }
      }
    });
  }

  /**
   * 验证必需字段存在
   * @param value 要验证的对象
   * @param requiredFields 必需字段列表
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果缺少必需字段
   */
  static validateRequiredFields(
    value: unknown,
    requiredFields: string[],
    fieldName: string
  ): void {
    this.validateObject(value, fieldName);

    for (const field of requiredFields) {
      if (
        !(field in (value as Record<string, unknown>)) ||
        (value as Record<string, unknown>)[field] === undefined ||
        (value as Record<string, unknown>)[field] === null
      ) {
        throw new ValidationError(
          `${fieldName}.${field}`,
          'defined',
          'undefined'
        );
      }
    }
  }

  /**
   * 类型安全断言（字符串）
   * @param value 要断言的值
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果类型不匹配
   */
  static assertIsString(
    value: unknown,
    fieldName: string
  ): asserts value is string {
    this.validateString(value, fieldName);
  }

  /**
   * 类型安全断言（数字）
   * @param value 要断言的值
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果类型不匹配
   */
  static assertIsNumber(
    value: unknown,
    fieldName: string
  ): asserts value is number {
    this.validateNumber(value, fieldName);
  }

  /**
   * 类型安全断言（对象）
   * @param value 要断言的值
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果类型不匹配
   */
  static assertIsObject(
    value: unknown,
    fieldName: string
  ): asserts value is Record<string, unknown> {
    this.validateObject(value, fieldName);
  }

  /**
   * 自定义验证器
   * @param value 要验证的值
   * @param validator 自定义验证函数
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果验证失败
   */
  static validateCustom<T>(
    value: T,
    validator: (value: T) => boolean,
    fieldName: string
  ): void {
    if (!validator(value)) {
      throw new ValidationError(
        fieldName,
        'custom validation',
        getActualType(value)
      );
    }
  }

  /**
   * 验证嵌套对象
   * @param value 要验证的值
   * @param schema 嵌套Schema定义
   * @param fieldName 字段名称（用于错误消息）
   * @throws ValidationError 如果验证失败
   */
  static validateNestedObject(
    value: unknown,
    schema: Record<string, any>,
    fieldName: string
  ): void {
    this.validateObject(value, fieldName);

    for (const [key, subSchema] of Object.entries(schema)) {
      const fieldValue = (value as Record<string, unknown>)[key];
      const fieldPath = `${fieldName}.${key}`;

      if (typeof subSchema === 'string') {
        // 简单类型验证
        switch (subSchema) {
          case 'string':
            this.validateString(fieldValue, fieldPath);
            break;
          case 'number':
            this.validateNumber(fieldValue, fieldPath);
            break;
          case 'boolean':
            this.validateBoolean(fieldValue, fieldPath);
            break;
          case 'array':
            this.validateArray(fieldValue, fieldPath);
            break;
          case 'object':
            this.validateObject(fieldValue, fieldPath);
            break;
        }
      } else if (typeof subSchema === 'object' && subSchema !== null) {
        // 嵌套对象验证
        this.validateNestedObject(fieldValue, subSchema, fieldPath);
      }
    }
  }
}
