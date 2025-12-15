---
paths: '**/*.{test,spec}.ts'
---

# Unit Testing Guidelines

> Note: Unit testing is not yet configured in this project. These guidelines apply when testing is set up.

## Recommended Setup

```bash
# Install Vitest
bun add -D vitest @testing-library/svelte jsdom
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [svelte({ hot: !process.env.VITEST })],
	test: {
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.ts'],
		globals: true,
	},
});
```

## Test File Structure

```
src/lib/services/
├── formatters.ts
└── formatters.test.ts    # Co-located test file
```

## Writing Tests

### Pure Functions

```typescript
import { describe, it, expect } from 'vitest';
import { formatJson, validateJson } from './formatters';

describe('formatJson', () => {
	it('formats valid JSON with default options', () => {
		const input = '{"a":1}';
		const result = formatJson(input);

		expect(result.ok).toBe(true);
		expect(result.value).toBe(`{
  "a": 1
}`);
	});

	it('returns error for invalid JSON', () => {
		const input = '{invalid}';
		const result = formatJson(input);

		expect(result.ok).toBe(false);
		expect(result.error).toContain('parse');
	});

	it('respects indent option', () => {
		const input = '{"a":1}';
		const result = formatJson(input, { indent: 4 });

		expect(result.value).toContain('    "a"');
	});
});

describe('validateJson', () => {
	it.each([
		['{}', true],
		['[]', true],
		['{"key": "value"}', true],
		['{invalid}', false],
		['', false],
	])('validates %s as %s', (input, expected) => {
		expect(validateJson(input).valid).toBe(expected);
	});
});
```

### Component Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Button from './button.svelte';

describe('Button', () => {
	it('renders with default props', () => {
		const { getByRole } = render(Button, {
			props: { children: 'Click me' },
		});

		expect(getByRole('button')).toHaveTextContent('Click me');
	});

	it('calls onclick handler', async () => {
		let clicked = false;
		const { getByRole } = render(Button, {
			props: {
				children: 'Click',
				onclick: () => (clicked = true),
			},
		});

		await fireEvent.click(getByRole('button'));
		expect(clicked).toBe(true);
	});

	it('applies variant classes', () => {
		const { getByRole } = render(Button, {
			props: {
				children: 'Button',
				variant: 'destructive',
			},
		});

		expect(getByRole('button')).toHaveClass('bg-destructive');
	});
});
```

## Test Organization

### AAA Pattern

```typescript
it('formats JSON with custom indent', () => {
	// Arrange
	const input = '{"name":"test"}';
	const options = { indent: 4 };

	// Act
	const result = formatJson(input, options);

	// Assert
	expect(result.ok).toBe(true);
	expect(result.value).toMatchSnapshot();
});
```

### Test Naming

```typescript
describe('ModuleName', () => {
	describe('functionName', () => {
		it('does something when condition', () => {});
		it('returns error when invalid input', () => {});
		it('handles edge case', () => {});
	});
});
```

## Best Practices

### Test Pure Logic

Focus on testing pure functions:

```typescript
// Good - test pure function
it('calculates diff correctly', () => {
	const result = findJsonDifferences(json1, json2);
	expect(result).toHaveLength(2);
});

// Avoid - testing implementation details
it('calls internal helper', () => {
	// Don't spy on internal functions
});
```

### Use Factories

```typescript
const createUser = (overrides = {}): User => ({
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

### Avoid Magic Numbers

```typescript
// Good
const EXPECTED_ITEMS = 5;
expect(result).toHaveLength(EXPECTED_ITEMS);

// Avoid
expect(result).toHaveLength(5);
```

## Running Tests

```bash
# Run all tests
bun run test

# Watch mode
bun run test:watch

# Coverage
bun run test:coverage

# Specific file
bun run test formatters.test.ts
```
