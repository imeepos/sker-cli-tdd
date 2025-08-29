/**
 * 🔴 TDD 红阶段：TypeValidator 运行时类型验证测试
 * 测试运行时类型验证的所有功能
 */

import { TypeValidator, ValidationError } from './type-validator';

describe('TypeValidator', () => {
  describe('基础类型验证', () => {
    it('应该验证字符串类型', () => {
      expect(() => TypeValidator.validateString('test', 'testField')).not.toThrow();
      expect(() => TypeValidator.validateString(123, 'testField')).toThrow(ValidationError);
      expect(() => TypeValidator.validateString(null, 'testField')).toThrow(ValidationError);
      expect(() => TypeValidator.validateString(undefined, 'testField')).toThrow(ValidationError);
    });

    it('应该验证数字类型', () => {
      expect(() => TypeValidator.validateNumber(123, 'testField')).not.toThrow();
      expect(() => TypeValidator.validateNumber(0, 'testField')).not.toThrow();
      expect(() => TypeValidator.validateNumber('123', 'testField')).toThrow(ValidationError);
      expect(() => TypeValidator.validateNumber(null, 'testField')).toThrow(ValidationError);
    });

    it('应该验证布尔类型', () => {
      expect(() => TypeValidator.validateBoolean(true, 'testField')).not.toThrow();
      expect(() => TypeValidator.validateBoolean(false, 'testField')).not.toThrow();
      expect(() => TypeValidator.validateBoolean('true', 'testField')).toThrow(ValidationError);
      expect(() => TypeValidator.validateBoolean(1, 'testField')).toThrow(ValidationError);
    });

    it('应该验证数组类型', () => {
      expect(() => TypeValidator.validateArray([], 'testField')).not.toThrow();
      expect(() => TypeValidator.validateArray([1, 2, 3], 'testField')).not.toThrow();
      expect(() => TypeValidator.validateArray('not-array', 'testField')).toThrow(ValidationError);
      expect(() => TypeValidator.validateArray(null, 'testField')).toThrow(ValidationError);
    });

    it('应该验证对象类型', () => {
      expect(() => TypeValidator.validateObject({}, 'testField')).not.toThrow();
      expect(() => TypeValidator.validateObject({ key: 'value' }, 'testField')).not.toThrow();
      expect(() => TypeValidator.validateObject([], 'testField')).toThrow(ValidationError);
      expect(() => TypeValidator.validateObject('string', 'testField')).toThrow(ValidationError);
      expect(() => TypeValidator.validateObject(null, 'testField')).toThrow(ValidationError);
    });
  });

  describe('可选类型验证', () => {
    it('应该允许可选字符串为undefined', () => {
      expect(() => TypeValidator.validateOptionalString(undefined, 'testField')).not.toThrow();
      expect(() => TypeValidator.validateOptionalString('test', 'testField')).not.toThrow();
      expect(() => TypeValidator.validateOptionalString(123, 'testField')).toThrow(ValidationError);
    });

    it('应该允许可选数字为undefined', () => {
      expect(() => TypeValidator.validateOptionalNumber(undefined, 'testField')).not.toThrow();
      expect(() => TypeValidator.validateOptionalNumber(123, 'testField')).not.toThrow();
      expect(() => TypeValidator.validateOptionalNumber('123', 'testField')).toThrow(ValidationError);
    });

    it('应该允许可选对象为undefined', () => {
      expect(() => TypeValidator.validateOptionalObject(undefined, 'testField')).not.toThrow();
      expect(() => TypeValidator.validateOptionalObject({}, 'testField')).not.toThrow();
      expect(() => TypeValidator.validateOptionalObject('string', 'testField')).toThrow(ValidationError);
    });
  });

  describe('复合类型验证', () => {
    it('应该验证枚举值', () => {
      const validValues = ['pending', 'in_progress', 'completed'];
      
      expect(() => TypeValidator.validateEnum('pending', validValues, 'status')).not.toThrow();
      expect(() => TypeValidator.validateEnum('invalid', validValues, 'status')).toThrow(ValidationError);
    });

    it('应该验证对象属性', () => {
      const schema = {
        name: 'string',
        age: 'number',
        active: 'boolean'
      };

      const validObject = { name: 'test', age: 25, active: true };
      const invalidObject = { name: 123, age: '25', active: 'yes' };

      expect(() => TypeValidator.validateObjectSchema(validObject, schema, 'user')).not.toThrow();
      expect(() => TypeValidator.validateObjectSchema(invalidObject, schema, 'user')).toThrow(ValidationError);
    });

    it('应该验证数组元素类型', () => {
      expect(() => TypeValidator.validateArrayOfType(['a', 'b', 'c'], 'string', 'names')).not.toThrow();
      expect(() => TypeValidator.validateArrayOfType([1, 2, 3], 'number', 'numbers')).not.toThrow();
      expect(() => TypeValidator.validateArrayOfType([1, 'two', 3], 'number', 'numbers')).toThrow(ValidationError);
    });

    it('应该验证必需属性存在', () => {
      const obj = { name: 'test', age: 25 };
      const requiredFields = ['name', 'age'];
      const missingFields = ['name', 'age', 'email'];

      expect(() => TypeValidator.validateRequiredFields(obj, requiredFields, 'user')).not.toThrow();
      expect(() => TypeValidator.validateRequiredFields(obj, missingFields, 'user')).toThrow(ValidationError);
    });
  });

  describe('高级验证功能', () => {
    it('应该提供类型安全的断言', () => {
      const value: unknown = 'test';
      
      TypeValidator.assertIsString(value, 'testField');
      expect(typeof value).toBe('string'); // TypeScript应该推断value现在是string类型
    });

    it('应该支持自定义验证器', () => {
      const emailValidator = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      
      expect(() => TypeValidator.validateCustom('test@example.com', emailValidator, 'email')).not.toThrow();
      expect(() => TypeValidator.validateCustom('invalid-email', emailValidator, 'email')).toThrow(ValidationError);
    });

    it('应该支持嵌套对象验证', () => {
      const schema = {
        user: {
          name: 'string',
          profile: {
            age: 'number',
            active: 'boolean'
          }
        }
      };

      const validNested = {
        user: {
          name: 'test',
          profile: {
            age: 25,
            active: true
          }
        }
      };

      const invalidNested = {
        user: {
          name: 'test',
          profile: {
            age: '25',
            active: 'yes'
          }
        }
      };

      expect(() => TypeValidator.validateNestedObject(validNested, schema, 'data')).not.toThrow();
      expect(() => TypeValidator.validateNestedObject(invalidNested, schema, 'data')).toThrow(ValidationError);
    });
  });

  describe('ValidationError', () => {
    it('应该包含详细的错误信息', () => {
      try {
        TypeValidator.validateString(123, 'testField');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).fieldName).toBe('testField');
        expect((error as ValidationError).expectedType).toBe('string');
        expect((error as ValidationError).actualType).toBe('number');
        expect((error as ValidationError).message).toContain('testField');
      }
    });

    it('应该支持错误信息本地化', () => {
      try {
        TypeValidator.validateString(123, 'testField');
      } catch (error) {
        expect((error as ValidationError).message).toContain('应该是');
        expect((error as ValidationError).message).toContain('string');
      }
    });
  });
});