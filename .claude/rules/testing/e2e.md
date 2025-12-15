---
paths: '{**/*.e2e.ts,tests/**/*.ts}'
---

# E2E Testing Guidelines

> Note: E2E testing is not yet configured in this project. These guidelines apply when testing is set up.

## Recommended Setup

### Playwright for Web

```bash
bun add -D @playwright/test
npx playwright install
```

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	use: {
		baseURL: 'http://localhost:5173',
	},
	webServer: {
		command: 'bun run dev',
		port: 5173,
		reuseExistingServer: true,
	},
});
```

### Tauri E2E (WebDriver)

For testing the desktop app:

```bash
# Install WebDriver client
bun add -D @tauri-apps/api webdriverio
```

## Writing E2E Tests

### Page Object Pattern

```typescript
// tests/e2e/pages/json-formatter.page.ts
import { Page } from '@playwright/test';

export class JsonFormatterPage {
	constructor(private page: Page) {}

	async goto() {
		await this.page.goto('/json-formatter');
	}

	async setInput(json: string) {
		await this.page.locator('[data-testid="json-input"]').fill(json);
	}

	async clickFormat() {
		await this.page.getByRole('button', { name: 'Format' }).click();
	}

	async getOutput() {
		return this.page.locator('[data-testid="json-output"]').textContent();
	}

	async getErrorMessage() {
		return this.page.locator('[data-testid="error-message"]').textContent();
	}
}
```

### Test Structure

```typescript
// tests/e2e/json-formatter.e2e.ts
import { test, expect } from '@playwright/test';
import { JsonFormatterPage } from './pages/json-formatter.page';

test.describe('JSON Formatter', () => {
	let page: JsonFormatterPage;

	test.beforeEach(async ({ page: playwrightPage }) => {
		page = new JsonFormatterPage(playwrightPage);
		await page.goto();
	});

	test('formats valid JSON', async () => {
		await page.setInput('{"name":"test"}');
		await page.clickFormat();

		const output = await page.getOutput();
		expect(output).toContain('"name": "test"');
	});

	test('shows error for invalid JSON', async () => {
		await page.setInput('{invalid}');
		await page.clickFormat();

		const error = await page.getErrorMessage();
		expect(error).toContain('Invalid');
	});
});
```

## Data Attributes

Add test IDs to components for reliable selection:

```svelte
<script lang="ts">
	interface Props {
		'data-testid'?: string;
	}

	let { 'data-testid': testId }: Props = $props();
</script>

<div data-testid={testId}>
	<!-- content -->
</div>
```

Usage:

```svelte
<JsonInput data-testid="json-input" />
<JsonOutput data-testid="json-output" />
```

## User-Centric Selectors

Prefer accessible selectors:

```typescript
// Good - user-centric
await page.getByRole('button', { name: 'Format' }).click();
await page.getByLabel('JSON Input').fill(json);
await page.getByText('Copy to clipboard').click();

// Acceptable - data-testid
await page.locator('[data-testid="format-button"]').click();

// Avoid - implementation details
await page.locator('.btn-primary').click();
await page.locator('#input-field').fill(json);
```

## Assertions

```typescript
// Visibility
await expect(page.getByRole('alert')).toBeVisible();
await expect(page.getByText('Error')).toBeHidden();

// Content
await expect(page.locator('output')).toHaveText('formatted');
await expect(page.locator('output')).toContainText('name');

// State
await expect(page.getByRole('button')).toBeEnabled();
await expect(page.getByRole('checkbox')).toBeChecked();

// Count
await expect(page.getByRole('listitem')).toHaveCount(5);
```

## Waiting

```typescript
// Wait for element
await page.waitForSelector('[data-testid="result"]');

// Wait for network
await page.waitForResponse('**/api/data');

// Wait for load state
await page.waitForLoadState('networkidle');

// Custom wait
await expect(page.locator('.result')).toBeVisible({ timeout: 10000 });
```

## Test Organization

```
tests/
├── e2e/
│   ├── pages/               # Page objects
│   │   ├── home.page.ts
│   │   └── json-formatter.page.ts
│   ├── fixtures/            # Test data
│   │   └── sample-data.json
│   ├── home.e2e.ts
│   └── json-formatter.e2e.ts
└── support/
    └── helpers.ts           # Shared utilities
```

## Running E2E Tests

```bash
# Run all E2E tests
bun run test:e2e

# Run with UI
bun run test:e2e --ui

# Run specific file
bun run test:e2e json-formatter.e2e.ts

# Debug mode
bun run test:e2e --debug

# Generate report
bun run test:e2e --reporter=html
```

## Best Practices

1. **Isolate tests** - Each test should be independent
2. **Clean up state** - Reset data between tests
3. **Use fixtures** - Share test data setup
4. **Avoid sleeps** - Use proper waits
5. **Test user flows** - Focus on real user scenarios
6. **Keep tests fast** - Optimize for CI/CD
