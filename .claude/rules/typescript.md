---
paths: src/**/*.{ts,svelte}
---

# TypeScript Guidelines

> **IMPORTANT**: Do not bypass linter or compiler errors using `// @ts-ignore`, `// @ts-expect-error`, `// biome-ignore`, `eslint-disable`, or similar directives. Fix the root cause instead.

## Linter Enforcement

The following rules are enforced by Biome and should not be documented here to avoid duplication:

- Template literals (`useTemplate`)
- Non-null assertion prohibition (`noNonNullAssertion`)
- `any` type prohibition (`noExplicitAny`)
- `else` after `return` prohibition (`noUselessElse`)
- `import type` / `export type` (`useImportType`, `useExportType`)
- Optional chaining (`useOptionalChain`)

See `biome.json` for the complete linter configuration.

## Fundamental Principles

### Reference Compliance

- Always follow the latest TypeScript official documentation
- Use the most modern syntax available in the project's TypeScript version
- Avoid deprecated patterns and legacy syntax

### Core Rules

| Rule            | Requirement                                          |
| --------------- | ---------------------------------------------------- |
| Pure functions  | No side effects, deterministic output                |
| Immutability    | Use `readonly`, avoid mutation                       |
| Early returns   | Always use guard clauses                             |
| Method chaining | Prefer `.filter()`, `.map()`, `.reduce()` over loops |
| No `\n`         | Never use escape sequences for newlines              |

## Pure Functional Style

Prioritize pure functions without side effects:

```typescript
// Preferred: Pure function - no side effects, deterministic output
export const calculateTotal = (items: readonly Item[]): number =>
	items.reduce((sum, item) => sum + item.price * item.quantity, 0);

// Preferred: Separate pure logic from stateful wrappers
export const formatCurrency = (value: number, locale: string): string =>
	new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value);
```

### Immutability

```typescript
// Preferred: Use readonly for immutable data
interface Config {
	readonly baseUrl: string;
	readonly timeout: number;
}

// Preferred: Spread for immutable updates
const updatedUser = { ...user, name: newName };

// Preferred: Array methods that return new arrays
const filtered = items.filter((item) => item.active);
const mapped = items.map((item) => ({ ...item, processed: true }));
```

## Early Returns

Always use early returns to reduce nesting:

```typescript
// Preferred: Early returns with guard clauses
const processData = (input: string | null): Result => {
	if (!input) return { error: 'Empty input' };
	if (input.length > MAX_LENGTH) return { error: 'Too long' };
	return { data: transform(input) };
};
```

## Method Chaining

Prefer method chaining over imperative loops for data transformation:

```typescript
// Preferred: Method chaining for transformation
const result = items.filter((item) => item.active).map((item) => item.value * 2);

// Preferred: Reduce for aggregation
const total = items.filter((item) => item.active).reduce((sum, item) => sum + item.value, 0);

// Preferred: Find for single item lookup
const found = items.find((item) => item.id === targetId);

// Preferred: Some/Every for boolean checks
const hasActive = items.some((item) => item.active);
const allValid = items.every((item) => item.valid);
```

### forEach for Side Effects Only

Use `forEach` only when performing side effects without producing a new value:

```typescript
// Acceptable: forEach for side effects only
items.forEach((item) => item.reset());

// Preferred: Use map instead of forEach when building arrays
const result = items.map((item) => item.name);
```

## Multiline Strings

Never use `\n` escape sequences. Always use template literals with actual line breaks:

```typescript
// Preferred: Template literals with actual line breaks
const text = `Line 1
Line 2
Line 3`;

// Preferred: Array join for dynamic multiline content
const lines = [`Name: ${user.name}`, `Email: ${user.email}`, `Role: ${user.role}`].join('\n');
```

## Modern Syntax

```typescript
// Preferred: `as const satisfies` for type-checked constants
export const CONFIG = {
	timeout: 30000,
	retries: 3,
} as const satisfies ConfigOptions;

// Preferred: Derived types from constants
export const OPTIONS = ['option1', 'option2', 'option3'] as const;
export type OptionType = (typeof OPTIONS)[number];

// Preferred: const type parameters (TS 5.0+) for literal inference
const createConfig = <const T extends Record<string, unknown>>(config: T): T => config;

// Preferred: using for automatic resource cleanup (TS 5.2+)
using file = new DisposableResource();
```

## Type Definition Patterns

### Interface vs Type

```typescript
// Preferred: Interface for object shapes
interface DataModel {
	readonly id: string;
	readonly name: string;
	readonly value: number;
}

// Preferred: Type for unions, intersections, mapped types
type Status = 'pending' | 'active' | 'completed';
type Nullable<T> = T | null;
```

### Result Pattern

```typescript
type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

const parse = <T>(input: string): Result<T> => {
	try {
		return { ok: true, value: JSON.parse(input) as T };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
};
```

### Discriminated Unions

```typescript
type AsyncState<T> =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'success'; data: T }
	| { status: 'error'; error: string };
```

## Type Assertions

```typescript
// Preferred: Type guards over assertions
const isString = (value: unknown): value is string => typeof value === 'string';

// Preferred: Use satisfies for inference + checking
const config = {
	baseURL: '/api/',
	timeout: 30000,
} as const satisfies Config;

// Preferred: Fallback over non-null assertion
const value = array.find((x) => x.id === id) ?? defaultValue;
```

## Function Patterns

### Arrow Functions with Explicit Types

```typescript
// Preferred: Export functions with explicit return types
export const transform = (input: string): string => input.toUpperCase();

// Preferred: Complex functions with proper typing
export const processItems = (
	items: readonly Item[],
	options: ProcessOptions = {}
): ProcessResult => {
	// implementation
};
```

### Higher-Order Functions

```typescript
const withErrorHandling =
	<T extends readonly unknown[], R>(fn: (...args: T) => R, fallback: R) =>
	(...args: T): R => {
		try {
			return fn(...args);
		} catch {
			return fallback;
		}
	};
```

## Error Handling

### Custom Error Classes

```typescript
export class ValidationError extends Error {
	constructor(
		message: string,
		public readonly field?: string
	) {
		super(message);
		this.name = 'ValidationError';
	}
}
```

### Error Message Extraction

```typescript
const getErrorMessage = (e: unknown, fallback = 'Unknown error'): string => {
	if (e instanceof Error) return e.message;
	if (typeof e === 'string') return e;
	return fallback;
};
```

## Naming Conventions

| Type                | Convention       | Example                     |
| ------------------- | ---------------- | --------------------------- |
| Variables/Functions | camelCase        | `userData`, `handleClick`   |
| Types/Interfaces    | PascalCase       | `UserData`, `ButtonVariant` |
| Constants           | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_URL`    |
| Object Constants    | UPPER_SNAKE_CASE | `COLORS`, `CONFIG`          |

## Comments

### When to Comment

- Complex algorithms
- Non-obvious business logic
- Workarounds for known issues
- Public API documentation

### Avoid

- Stating the obvious
- Leaving commented-out code
- Adding comments that duplicate TypeDoc

## Best Practices Summary

- Use `readonly` for immutable properties
- Prefer explicit return types on exported functions
- Use type guards over type assertions
- Derive types from constants with `(typeof X)[number]`
- Never use `\n` escape sequences; use actual line breaks
- Prefer method chaining over `for`, `while` for data transformation
