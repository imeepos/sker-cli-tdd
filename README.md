# TypeScript TDD Project with tsup and turbo

This project demonstrates a complete TypeScript setup following **strict Test-Driven Development (TDD)** principles, using modern tooling including tsup for building and turbo for task orchestration.

## 🔴🟢🔄 TDD Workflow Demonstrated

This project strictly follows the **Red-Green-Refactor** cycle:

### 🔴 Red Phase: Write Failing Tests First
- ✅ Created failing tests in `src/index.test.ts` before any implementation
- ✅ Confirmed tests fail for the right reasons (missing implementation)

### 🟢 Green Phase: Minimal Implementation
- ✅ Implemented `Calculator` class with minimal code to make tests pass
- ✅ All tests now pass with the simplest possible implementation

### 🔄 Refactor Phase: Improve Code Quality
- ✅ Code is clean and follows TypeScript best practices
- ✅ Tests provide safety net for future refactoring

## 🛠️ Tech Stack

- **TypeScript**: Strict type checking with comprehensive compiler options
- **Jest**: Testing framework with ts-jest for TypeScript support
- **tsup**: Fast TypeScript bundler for building CJS/ESM/DTS outputs
- **turbo**: Task orchestration and caching for optimal build performance

## 📁 Project Structure

```
sker-ai/
├── src/
│   ├── calculator.ts      # Implementation (created after tests)
│   ├── index.ts          # Main entry point
│   └── index.test.ts     # Tests (created first - TDD principle)
├── tests/
│   └── setup.ts          # Jest test setup
├── dist/                 # Build output (generated)
├── coverage/             # Test coverage reports
├── jest.config.js        # Jest configuration
├── tsconfig.json         # TypeScript configuration
├── tsup.config.ts        # tsup build configuration
├── turbo.json           # turbo task configuration
└── package.json         # Project dependencies and scripts
```

## 🚀 Available Scripts

### Testing (TDD Core)
```bash
npm run test              # Run all tests via turbo
npm run test:unit         # Run Jest tests directly
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Generate coverage report
```

### Building
```bash
npm run build             # Build via turbo (runs tests first)
npm run build:tsup        # Build directly with tsup
npm run dev               # Development mode with watch
```

### Quality Assurance
```bash
npm run type-check        # TypeScript type checking
npm run lint              # Code linting (placeholder)
npm run clean             # Clean build artifacts
```

## 🎯 TDD Principles Enforced

1. **Test-First Development**: No production code without failing tests
2. **Red-Green-Refactor**: Strict adherence to the TDD cycle
3. **Minimal Implementation**: Write only code needed to pass tests
4. **Test Independence**: Each test runs independently
5. **Fast Feedback**: Quick test execution for rapid iteration

## 📊 Test Coverage

The project enforces 95% test coverage across:
- Branches
- Functions  
- Lines
- Statements

## 🔧 Configuration Highlights

### TypeScript (tsconfig.json)
- Strict mode enabled
- ES2022 target
- Comprehensive type checking options
- Source maps and declarations generated

### Jest (jest.config.js)
- ts-jest preset for TypeScript support
- Coverage thresholds enforced
- Test setup file for consistent environment

### tsup (tsup.config.ts)
- Dual CJS/ESM output
- TypeScript declarations
- Source maps
- Tree shaking enabled

### turbo (turbo.json)
- Test-dependent build pipeline
- Intelligent caching
- Parallel task execution

## 🏃‍♂️ Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run tests** (TDD first!):
   ```bash
   npm run test
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Start development**:
   ```bash
   npm run dev
   ```

## 📈 Next Steps for TDD Development

To add new features following TDD:

1. **🔴 Red**: Write a failing test for the new feature
2. **🟢 Green**: Implement minimal code to make the test pass
3. **🔄 Refactor**: Improve code quality while keeping tests green
4. **Repeat**: Continue the cycle for each new requirement

## 🎓 TDD Best Practices Demonstrated

- ✅ Tests written before implementation
- ✅ One test case at a time
- ✅ Descriptive test names
- ✅ Arrange-Act-Assert pattern
- ✅ Independent test cases
- ✅ Fast test execution
- ✅ High test coverage
- ✅ Continuous refactoring with test safety net
