---
paths: 'src/**/*.{test,spec}.ts'
---

# TypeScript/Svelte Testing Guidelines

## Test Framework

This project uses [Vitest](https://vitest.dev/) for unit and component testing.

## Test File Structure

Place test files alongside the code they test:

```
src/lib/services/
├── formatters.ts
└── formatters.test.ts    # Co-located test file

src/lib/components/ui/
├── button.svelte
└── button.test.ts        # Component test
```

## Running Tests

```bash
# Run all tests once
bun run test

# Watch mode (re-runs on file changes)
bun run test:watch

# With UI
bun run test:ui

# With coverage
bun run test:coverage

# Run specific file
bun run test formatters.test.ts

# Run tests matching pattern
bun run test -- --grep "formatJson"
```

## Writing Unit Tests

### Pure Functions

```typescript
import { describe, it, expect } from 'vitest';
import { formatJson, validateJson } from './formatters';

describe('formatJson', () => {
	it('formats valid JSON with default options', () => {
		const input = '{"a":1}';

		const result = formatJson(input);

		expect(result).toContain('"a"');
		expect(result).toContain('1');
	});

	it('throws error for invalid JSON', () => {
		const input = '{invalid}';

		expect(() => formatJson(input)).toThrow();
	});

	it('respects indent option', () => {
		const input = '{"a":1}';

		const result = formatJson(input, { indentSize: 4 });

		expect(result).toContain('    ');
	});
});

describe('validateJson', () => {
	it.each([
		['{}', true],
		['[]', true],
		['{"key": "value"}', true],
		['{invalid}', false],
		['', false],
	])('validates "%s" as %s', (input, expected) => {
		const result = validateJson(input);

		expect(result.valid).toBe(expected);
	});
});
```

### Async Functions

```typescript
describe('fetchData', () => {
	it('returns data on success', async () => {
		const result = await fetchData('valid-id');

		expect(result).toBeDefined();
		expect(result.id).toBe('valid-id');
	});

	it('throws on invalid id', async () => {
		await expect(fetchData('invalid')).rejects.toThrow('Not found');
	});
});
```

## Component Testing

### Basic Component Test

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Button from './button.svelte';

describe('Button', () => {
	it('renders with text', () => {
		render(Button, { props: { children: 'Click me' } });

		expect(screen.getByRole('button')).toHaveTextContent('Click me');
	});

	it('calls onclick handler when clicked', async () => {
		let clicked = false;
		render(Button, {
			props: {
				children: 'Click',
				onclick: () => {
					clicked = true;
				},
			},
		});

		await fireEvent.click(screen.getByRole('button'));

		expect(clicked).toBe(true);
	});

	it('applies variant classes', () => {
		render(Button, {
			props: {
				children: 'Button',
				variant: 'destructive',
			},
		});

		expect(screen.getByRole('button')).toHaveClass('bg-destructive');
	});

	it('is disabled when disabled prop is true', () => {
		render(Button, {
			props: {
				children: 'Button',
				disabled: true,
			},
		});

		expect(screen.getByRole('button')).toBeDisabled();
	});
});
```

### Testing User Interactions

```typescript
import { render, screen, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Input from './input.svelte';

describe('Input', () => {
	it('updates value on user input', async () => {
		const user = userEvent.setup();
		render(Input, { props: { placeholder: 'Enter text' } });

		const input = screen.getByPlaceholderText('Enter text');
		await user.type(input, 'Hello');

		expect(input).toHaveValue('Hello');
	});
});
```

## Test Organization

### AAA Pattern (Arrange-Act-Assert)

```typescript
it('formats JSON with custom indent', () => {
	// Arrange
	const input = '{"name":"test"}';
	const options = { indentSize: 4 };

	// Act
	const result = formatJson(input, options);

	// Assert
	expect(result).toContain('    "name"');
});
```

### Descriptive Test Names

```typescript
describe('ModuleName', () => {
	describe('functionName', () => {
		it('returns expected value when given valid input', () => {});
		it('throws error when input is null', () => {});
		it('handles empty string gracefully', () => {});
	});
});
```

### Grouping Related Tests

```typescript
describe('formatters', () => {
	describe('JSON', () => {
		describe('formatJson', () => {
			it('formats simple object', () => {});
			it('formats nested object', () => {});
			it('formats array', () => {});
		});

		describe('validateJson', () => {
			it('returns true for valid JSON', () => {});
			it('returns false for invalid JSON', () => {});
		});
	});

	describe('XML', () => {
		// XML formatter tests
	});
});
```

## Assertions

### Common Matchers

```typescript
// Equality
expect(value).toBe(expected); // Strict equality (===)
expect(value).toEqual(expected); // Deep equality
expect(value).toStrictEqual(expected); // Deep equality + type

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeLessThanOrEqual(10);
expect(value).toBeCloseTo(0.3, 5); // Float comparison

// Strings
expect(value).toContain('substring');
expect(value).toMatch(/pattern/);

// Arrays
expect(array).toContain(item);
expect(array).toHaveLength(3);
expect(array).toEqual(expect.arrayContaining([1, 2]));

// Objects
expect(obj).toHaveProperty('key');
expect(obj).toHaveProperty('nested.key', 'value');
expect(obj).toMatchObject({ key: 'value' });

// Exceptions
expect(() => fn()).toThrow();
expect(() => fn()).toThrow('error message');
expect(() => fn()).toThrow(ErrorClass);

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();
```

### DOM Matchers (jest-dom)

```typescript
expect(element).toBeInTheDocument();
expect(element).toBeVisible();
expect(element).toBeDisabled();
expect(element).toHaveTextContent('text');
expect(element).toHaveAttribute('href', '/path');
expect(element).toHaveClass('active');
expect(element).toHaveValue('input value');
expect(element).toHaveFocus();
```

## Mocking

### Mock Functions

```typescript
import { vi } from 'vitest';

const mockFn = vi.fn();
mockFn.mockReturnValue('default');
mockFn.mockReturnValueOnce('first call');
mockFn.mockImplementation((x) => x * 2);

expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith('arg');
expect(mockFn).toHaveBeenCalledTimes(3);
```

### Mock Modules

```typescript
import { vi } from 'vitest';

// Mock entire module
vi.mock('./api', () => ({
	fetchUser: vi.fn().mockResolvedValue({ id: 1, name: 'Test' }),
}));

// Mock specific exports
vi.mock('./utils', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		formatDate: vi.fn().mockReturnValue('2024-01-01'),
	};
});
```

### Spy on Methods

```typescript
import { vi } from 'vitest';

const spy = vi.spyOn(console, 'log');
// ... run code
expect(spy).toHaveBeenCalledWith('expected message');
spy.mockRestore();
```

## Test Data

### Factories

```typescript
const createUser = (overrides: Partial<User> = {}): User => ({
	id: '1',
	name: 'Test User',
	email: 'test@example.com',
	...overrides,
});

it('displays user name', () => {
	const user = createUser({ name: 'John' });
	// ...
});
```

### Constants

```typescript
const VALID_JSON = '{"name": "test", "value": 123}';
const INVALID_JSON = '{name: invalid}';
const EMPTY_OBJECT = '{}';
const NESTED_JSON = '{"user": {"name": "John", "address": {"city": "Tokyo"}}}';

describe('formatJson', () => {
	it('formats valid JSON', () => {
		const result = formatJson(VALID_JSON);
		expect(result).toBeDefined();
	});
});
```

## Best Practices

### Do's

- Write tests as you develop (TDD when appropriate)
- Keep tests small and focused on one behavior
- Use descriptive test names that explain the scenario
- Test edge cases and error conditions
- Use `it.each` for parameterized tests
- Mock external dependencies (APIs, file system)
- Clean up after tests (reset mocks, clear timers)

### Don'ts

- Don't test implementation details
- Don't share mutable state between tests
- Don't make tests dependent on execution order
- Don't test third-party library functionality
- Don't use magic numbers without constants
- Don't write tests that always pass
- Don't ignore flaky tests

### Test Independence

```typescript
// Good: Each test is self-contained
describe('counter', () => {
	it('increments from 0 to 1', () => {
		const counter = createCounter();
		counter.increment();
		expect(counter.value).toBe(1);
	});

	it('decrements from 0 to -1', () => {
		const counter = createCounter();
		counter.decrement();
		expect(counter.value).toBe(-1);
	});
});

// Avoid: Tests sharing state
let counter: Counter;
beforeAll(() => {
	counter = createCounter();
});
// Tests depend on shared counter state
```

### Cleanup

```typescript
import { afterEach, vi } from 'vitest';

afterEach(() => {
	vi.restoreAllMocks();
	vi.clearAllTimers();
});
```

## Coverage Goals

- Aim for high coverage on core business logic (services, utilities)
- Don't chase 100% coverage at the expense of meaningful tests
- Focus on testing critical paths and edge cases
- Exclude generated code and type definitions from coverage

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library - Svelte](https://testing-library.com/docs/svelte-testing-library/intro)
- [Svelte Testing Guide](https://svelte.dev/docs/svelte/testing)
- [jest-dom Matchers](https://github.com/testing-library/jest-dom)
