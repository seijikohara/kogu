---
paths: src/**/*.{ts,svelte}
---

# TypeScript Guidelines

## Fundamental Principles

### Reference Compliance

- Always follow the latest TypeScript official documentation
- Use the most modern syntax available in the project's TypeScript version
- Avoid deprecated patterns and legacy syntax

### Core Rules (Mandatory)

| Rule              | Requirement                                               |
| ----------------- | --------------------------------------------------------- |
| Pure functions    | No side effects, deterministic output                     |
| Immutability      | Use `readonly`, avoid mutation                            |
| Early returns     | Always use guard clauses, never use `else` after `return` |
| Method chaining   | Always use `.filter()`, `.map()`, `.reduce()` over loops  |
| Template literals | Always use `${interpolation}` for string building         |
| No `\n`           | Never use escape sequences for newlines                   |

## Pure Functional Style

Prioritize pure functions without side effects:

```typescript
// Preferred: Pure function - no side effects, deterministic output
export const calculateTotal = (items: readonly Item[]): number =>
	items.reduce((sum, item) => sum + item.price * item.quantity, 0);

// Preferred: Separate pure logic from stateful wrappers
export const formatCurrency = (value: number, locale: string): string =>
	new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value);

// Avoid: Function with side effects
function processData(data: Data): void {
	console.log(data); // Side effect
	globalState.data = data; // Mutation
}
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

// Avoid: Direct mutation
user.name = newName; // Mutation
items.push(newItem); // Mutation
```

## Early Returns (Mandatory)

Always use early returns to reduce nesting. Never use `else` after a `return` statement:

```typescript
// Preferred: Early returns with guard clauses
const processData = (input: string | null): Result => {
	if (!input) return { error: 'Empty input' };
	if (input.length > MAX_LENGTH) return { error: 'Too long' };
	return { data: transform(input) };
};

// Avoid: Nested conditionals
const processData = (input: string | null): Result => {
	if (input) {
		if (input.length <= MAX_LENGTH) {
			return { data: transform(input) };
		} else {
			return { error: 'Too long' };
		}
	} else {
		return { error: 'Empty input' };
	}
};
```

## Method Chaining (Mandatory)

Use method chaining instead of imperative loops. Never use `for`, `while`, or `forEach` for data transformation:

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

// Avoid: Imperative loops
const result: number[] = [];
for (const item of items) {
	if (item.active) {
		result.push(item.value * 2);
	}
}
```

### forEach for Side Effects Only

Use `forEach` only when performing side effects without producing a new value:

```typescript
// Acceptable: forEach for side effects only
items.forEach((item) => item.reset());
nodes.forEach((node) => traverse(node, depth + 1));

// Avoid: forEach when building a new array
const result: string[] = [];
items.forEach((item) => result.push(item.name));

// Preferred: Use map instead
const result = items.map((item) => item.name);
```

## String Handling (Mandatory)

### Template Literals

Always use template literals for string construction. Never use string concatenation:

```typescript
// Preferred: Template literals
const message = `Hello, ${name}!`;
const path = `${baseUrl}/api/${endpoint}`;
const className = `btn btn-${variant} ${isActive ? 'active' : ''}`;

// Avoid: String concatenation
const message = 'Hello, ' + name + '!';
const path = baseUrl + '/api/' + endpoint;
```

### Multiline Strings (No `\n`)

Never use `\n` escape sequences. Always use template literals with actual line breaks:

```typescript
// Preferred: Template literals with actual line breaks
const text = `Line 1
Line 2
Line 3`;

const sql = `
  SELECT *
  FROM users
  WHERE active = true
`;

// Preferred: Array join for dynamic multiline content
const lines = [`Name: ${user.name}`, `Email: ${user.email}`, `Role: ${user.role}`].join('\n');

// Avoid: Escape sequences
const text = 'Line 1\nLine 2\nLine 3';
const sql = 'SELECT *\nFROM users\nWHERE active = true';
```

## Modern Syntax Enforcement

Always use the latest TypeScript syntax features:

```typescript
// Preferred: `as const satisfies` for type-checked constants
export const CONFIG = {
	timeout: 30000,
	retries: 3,
} as const satisfies ConfigOptions;

// Preferred: Optional chaining and nullish coalescing
const value = obj?.nested?.property ?? defaultValue;

// Preferred: `import type` for type-only imports
import type { ComponentProps } from 'svelte';

// Preferred: Derived types from constants
export const OPTIONS = ['option1', 'option2', 'option3'] as const;
export type OptionType = (typeof OPTIONS)[number];

// Preferred: const type parameters (TS 5.0+) for literal inference
const createConfig = <const T extends Record<string, unknown>>(config: T): T => config;
const myConfig = createConfig({ port: 3000 }); // { readonly port: 3000 }

// Preferred: using for automatic resource cleanup (TS 5.2+)
using file = new DisposableResource();
// Automatically disposed when scope ends
```

### Avoid Enums

Prefer `as const` objects over enums for better tree-shaking and type inference:

```typescript
// Preferred: as const object
export const Status = {
	Active: 'active',
	Inactive: 'inactive',
	Pending: 'pending',
} as const;
export type Status = (typeof Status)[keyof typeof Status];

// Avoid: enum (poor tree-shaking, runtime overhead)
enum Status {
	Active = 'active',
	Inactive = 'inactive',
}
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

## Object Literals Over Switch

Use object maps for type-safe lookups:

```typescript
// Preferred: Object literal with type safety
const TYPE_CLASSES = {
	success: 'bg-green-500 text-white',
	error: 'bg-red-500 text-white',
	warning: 'bg-yellow-500 text-black',
} as const satisfies Record<string, string>;

const getClass = (type: keyof typeof TYPE_CLASSES): string => TYPE_CLASSES[type];

// Avoid: Switch statement
const getClass = (type: string): string => {
	switch (type) {
		case 'success':
			return 'bg-green-500 text-white';
		case 'error':
			return 'bg-red-500 text-white';
		default:
			return '';
	}
};
```

## Type Assertions

### Safe Type Assertions

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

### Avoid These Patterns

```typescript
// Avoid: Non-null assertion
const value = array.find((x) => x.id === id)!;

// Avoid: Type assertion when type guard is possible
const str = value as string;

// Avoid: any type
const data: any = response.body;
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

## Import Organization

```typescript
// 1. External packages
import { toast } from 'svelte-sonner';

// 2. Internal aliases ($lib)
import { Button } from '$lib/components/ui/button';
import { formatJson } from '$lib/services/formatters';
import { cn } from '$lib/utils';

// 3. Type imports (separate)
import type { Snippet } from 'svelte';
import type { TabProps } from './types';

// 4. Relative imports
import TabContent from './tab-content.svelte';
```

## Naming Conventions

| Type                | Convention       | Example                     |
| ------------------- | ---------------- | --------------------------- |
| Variables/Functions | camelCase        | `userData`, `handleClick`   |
| Types/Interfaces    | PascalCase       | `UserData`, `ButtonVariant` |
| Constants           | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_URL`    |
| Object Constants    | UPPER_SNAKE_CASE | `COLORS`, `CONFIG`          |

```typescript
// Variables and functions
const userData = fetchUser();
const handleClick = () => {};

// Types/Interfaces
interface UserData {}
type ButtonVariant = 'default' | 'outline';

// Constants
const MAX_RETRIES = 3;

// Object constants with as const satisfies
const COLORS = {
	primary: '#000',
	secondary: '#fff',
} as const satisfies Record<string, string>;
```

## Comments

### When to Comment

- Complex algorithms
- Non-obvious business logic
- Workarounds for known issues
- Public API documentation

### Style

```typescript
// Single line for brief explanations

/**
 * Multi-line for function documentation.
 * Explains what the function does and why.
 */
const processData = (data: unknown): Result => {
	// Implementation
};
```

### Avoid

- Stating the obvious
- Leaving commented-out code
- Adding comments that duplicate TypeDoc

## Recommended tsconfig.json

```json
{
	"compilerOptions": {
		"strict": true,
		"noUncheckedIndexedAccess": true,
		"noImplicitOverride": true,
		"noPropertyAccessFromIndexSignature": true,
		"noFallthroughCasesInSwitch": true,
		"verbatimModuleSyntax": true,
		"moduleResolution": "bundler"
	}
}
```

| Option                               | Effect                                       |
| ------------------------------------ | -------------------------------------------- |
| `strict`                             | Enables all strict type-checking options     |
| `noUncheckedIndexedAccess`           | Array access returns `T \| undefined`        |
| `noPropertyAccessFromIndexSignature` | Forces bracket notation for index signatures |
| `verbatimModuleSyntax`               | Enforces explicit `import type`              |

> **Note**: `exactOptionalPropertyTypes` is not used in this project due to incompatibility with shadcn-svelte component patterns where optional props can be `undefined`.

## Best Practices Summary

- Enable strict mode in tsconfig with additional strict flags
- Avoid `any` - use `unknown` for truly unknown types
- Use `readonly` for immutable properties
- Prefer explicit return types on exported functions
- Use type guards over type assertions
- Derive types from constants with `(typeof X)[number]`
- Always use template literals for string interpolation
- Never use `\n` escape sequences; use actual line breaks
- Never use `else` after `return`
- Never use `for`, `while` for data transformation
- Avoid enums; use `as const` objects instead
