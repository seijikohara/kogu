# Page Layout Patterns

This document defines the standard layout patterns used in Kogu pages.

## Base Structure (All Pages)

Every page in Kogu shares this common structure:

```
┌─────────────────────────────────────────────────────────────┐
│                        TitleBar                             │
│  [Traffic Lights]              [Minimize] [Maximize] [Close]│
├──────────┬──────────────────────────────────────────────────┤
│          │                   PageLayout                     │
│          │ ┌──────────────────────────────────────────────┐ │
│ AppSide  │ │ PageHeader                                   │ │
│  bar     │ │  [Icon] Title  [Tabs...]     [Status] [Valid]│ │
│          │ ├──────────────────────────────────────────────┤ │
│  [Home]  │ │                                              │ │
│  [JSON]  │ │              Main Content Area               │ │
│  [XML]   │ │                                              │ │
│  [YAML]  │ │         (varies by pattern below)            │ │
│  [SQL]   │ │                                              │ │
│  [...]   │ │                                              │ │
│          │ └──────────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────────┘
```

### Required Imports

```svelte
<script lang="ts">
	import { PageLayout } from '$lib/components/layout';
</script>
```

### Base Page Template

```svelte
<svelte:head>
	<title>Page Title - Kogu</title>
</svelte:head>

<PageLayout {valid} {error} bind:showOptions>
	{#snippet statusContent()}
		<!-- Stats display in header right side -->
	{/snippet}

	{#snippet options()}
		<!-- OptionsPanel content (FormSection components) -->
	{/snippet}

	<!-- Main content area -->
</PageLayout>
```

### PageLayout Props (All Patterns)

| Prop          | Type              | Default       | Description                         |
| ------------- | ----------------- | ------------- | ----------------------------------- |
| `title`       | `string`          | Auto from URL | Page title override                 |
| `valid`       | `boolean \| null` | `null`        | Validation state indicator          |
| `error`       | `string`          | `''`          | Error message to display            |
| `showOptions` | `boolean`         | `true`        | Options panel visibility (bindable) |

### PageLayout Snippets (All Patterns)

| Snippet         | Description                                   |
| --------------- | --------------------------------------------- |
| `statusContent` | Status bar content (stats, indicators)        |
| `options`       | OptionsPanel content (FormSection components) |
| `children`      | Main content area (default slot)              |

---

## Pattern Overview

| Pattern | Description                   | Pages                         |
| ------- | ----------------------------- | ----------------------------- |
| A       | Tabbed + Shared Input         | JSON, XML, YAML Formatter     |
| B       | Tabbed + Separate State       | URL Encoder                   |
| C       | OptionsPanel + SplitPane      | Base64 Encoder, SQL Formatter |
| D       | OptionsPanel + Vertical Split | Hash Generator, JWT Decoder   |
| E       | OptionsPanel + Form Results   | BCrypt, SSH, GPG Generator    |

---

## Pattern A: Tabbed + Shared Input

Multi-tab interface with shared input state across tabs using `useTabSync`.

```
┌─────────────────────────────────────────────────────────────┐
│ PageHeader  [Format] [Query] [Compare] [Convert] [Schema]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tab Content (varies by tab)                                │
│  - Format Tab: OptionsPanel + SplitPane                     │
│  - Query Tab: OptionsPanel + Query Results                  │
│  - Compare Tab: Diff View                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Additional Props (Pattern A/B)

| Prop               | Type                    | Description                             |
| ------------------ | ----------------------- | --------------------------------------- |
| `tabs`             | `Tab[]`                 | Tab definitions with id, label, icon    |
| `activeTab`        | `string`                | Currently active tab ID                 |
| `ontabchange`      | `(tab: string) => void` | Tab change handler                      |
| `preserveTabState` | `boolean`               | Keep tab content mounted when switching |

### Additional Snippet (Pattern A/B)

| Snippet                   | Description                            |
| ------------------------- | -------------------------------------- |
| `tabContent(tab: string)` | Tab content renderer (receives tab id) |

### Structure

```svelte
<script lang="ts">
	import { Play, Search } from '@lucide/svelte';
	import { PageLayout } from '$lib/components/layout';
	import { useTabSync } from '$lib/utils';
	import { FormatTab, QueryTab } from './tabs/index.js';

	const tabs = [
		{ id: 'format' as const, label: 'Format', icon: Play },
		{ id: 'query' as const, label: 'Query', icon: Search },
	] as const;

	const { activeTab, setActiveTab } = useTabSync({
		tabs: tabs.map((t) => t.id),
		defaultTab: 'format',
	});

	// Shared input across all tabs
	let sharedInput = $state('');
</script>

<PageLayout {tabs} {activeTab} ontabchange={(tab) => setActiveTab(tab)} preserveTabState>
	{#snippet tabContent(tab)}
		{#if tab === 'format'}
			<FormatTab input={sharedInput} onInputChange={(v) => (sharedInput = v)} />
		{:else if tab === 'query'}
			<QueryTab input={sharedInput} onInputChange={(v) => (sharedInput = v)} />
		{/if}
	{/snippet}
</PageLayout>
```

### Pages Using This Pattern

- `src/routes/json-formatter/+page.svelte`
- `src/routes/xml-formatter/+page.svelte`
- `src/routes/yaml-formatter/+page.svelte`

---

## Pattern B: Tabbed + Separate State

Multi-tab interface where each tab has independent state.

```
┌─────────────────────────────────────────────────────────────┐
│ PageHeader     [Encode/Decode] [Parse] [Build] [Reference]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tab Content (each tab has own state)                       │
│  - Encode Tab: OptionsPanel + SplitPane                     │
│  - Parse Tab: Input + Parsed Components                     │
│  - Build Tab: Form Builder                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Structure

```svelte
<script lang="ts">
  import { PageLayout, SplitPane } from '$lib/components/layout';
  import { OptionsPanel } from '$lib/components/panel';
  import { useTabSync } from '$lib/utils';

  const { activeTab, setActiveTab } = useTabSync({ ... });

  // Each tab has separate state
  let encodeInput = $state('');
  let parseInput = $state('');
</script>

<PageLayout {tabs} {activeTab} ontabchange={...} preserveTabState>
  {#snippet tabContent(tab)}
    {#if tab === 'encode'}
      <div class="flex h-full">
        <OptionsPanel ...>...</OptionsPanel>
        <SplitPane>...</SplitPane>
      </div>
    {:else if tab === 'parse'}
      <!-- Parse tab with parseInput state -->
    {/if}
  {/snippet}
</PageLayout>
```

### Pages Using This Pattern

- `src/routes/url-encoder/+page.svelte`

---

## Pattern C: OptionsPanel + SplitPane

Simple encoder/formatter with options panel and split input/output.

```
┌──────────────┬────────────────────────────────────────────┐
│ OptionsPanel │              SplitPane                     │
│              │  ┌─────────────────┬────────────────────┐  │
│  Mode:       │  │   CodeEditor    │    CodeEditor      │  │
│  [Format]    │  │   (Input)       │    (Output)        │  │
│  [Minify]    │  │                 │                    │  │
│              │  │                 │                    │  │
│  [Options]   │  │                 │                    │  │
│              │  └─────────────────┴────────────────────┘  │
└──────────────┴────────────────────────────────────────────┘
```

### Structure

```svelte
<script lang="ts">
	import { PageLayout, SplitPane } from '$lib/components/layout';
	import { CodeEditor } from '$lib/components/editor';
	import { FormMode, FormSection, FormSelect } from '$lib/components/form';

	let mode = $state<'format' | 'minify'>('format');
	let input = $state('');
	let showOptions = $state(true);

	const output = $derived(transform(input));
</script>

<PageLayout {valid} {error} bind:showOptions>
	{#snippet statusContent()}
		<!-- Stats display -->
	{/snippet}

	{#snippet options()}
		<FormSection title="Mode">
			<FormMode value={mode} onchange={(v) => (mode = v)} options={modeOptions} />
		</FormSection>
		<!-- Additional options -->
	{/snippet}

	<SplitPane class="h-full flex-1">
		{#snippet left()}
			<CodeEditor
				title="Input"
				value={input}
				onchange={(v) => (input = v)}
				mode="input"
				editorMode="sql"
				onsample={handleSample}
				onpaste={handlePaste}
				onclear={handleClear}
			/>
		{/snippet}
		{#snippet right()}
			<CodeEditor
				title="Output"
				value={output}
				mode="readonly"
				editorMode="sql"
				oncopy={handleCopy}
			/>
		{/snippet}
	</SplitPane>
</PageLayout>
```

### Pages Using This Pattern

- `src/routes/base64-encoder/+page.svelte`
- `src/routes/sql-formatter/+page.svelte`

---

## Pattern D: OptionsPanel + Vertical Split

Input editor on top, results panel on bottom.

```
┌──────────────┬────────────────────────────────────────────┐
│ OptionsPanel │              Main Area                     │
│              │  ┌──────────────────────────────────────┐  │
│  [Info]      │  │  CodeEditor (Input)                  │  │
│              │  │  h-1/3 shrink-0 border-b             │  │
│  [Security]  │  ├──────────────────────────────────────┤  │
│              │  │  Results Panel Header                │  │
│              │  │  h-9 bg-muted/30                     │  │
│              │  ├──────────────────────────────────────┤  │
│              │  │  Results Content                     │  │
│              │  │  flex-1 overflow-auto p-4            │  │
│              │  └──────────────────────────────────────┘  │
└──────────────┴────────────────────────────────────────────┘
```

### Structure

```svelte
<script lang="ts">
	import { PageLayout } from '$lib/components/layout';
	import { CodeEditor } from '$lib/components/editor';
	import { FormInfo, FormSection } from '$lib/components/form';

	let input = $state('');
	let showOptions = $state(true);

	const results = $derived(parseInput(input));
</script>

<PageLayout {valid} {error} bind:showOptions>
	{#snippet statusContent()}
		<!-- Stats display -->
	{/snippet}

	{#snippet options()}
		<FormSection title="About">
			<FormInfo>...</FormInfo>
		</FormSection>
	{/snippet}

	<div class="flex h-full flex-col overflow-hidden">
		<!-- Input Editor -->
		<div class="h-1/3 shrink-0 border-b">
			<CodeEditor
				title="Input"
				bind:value={input}
				mode="input"
				editorMode="plain"
				showViewToggle={false}
				onpaste={handlePaste}
				onclear={handleClear}
				onsample={handleSample}
			/>
		</div>

		<!-- Results Panel -->
		<div class="flex flex-1 flex-col overflow-hidden">
			<div class="flex h-9 shrink-0 items-center border-b bg-muted/30 px-3">
				<span class="text-xs font-medium text-muted-foreground">Results</span>
			</div>
			<div class="flex-1 overflow-auto p-4">
				{#if results.length > 0}
					<!-- Result cards -->
				{:else}
					<!-- Empty state -->
				{/if}
			</div>
		</div>
	</div>
</PageLayout>
```

### Pages Using This Pattern

- `src/routes/hash-generator/+page.svelte`
- `src/routes/jwt-decoder/+page.svelte`

---

## Pattern E: OptionsPanel + Form Results

Form inputs in options panel, results displayed in main area.

```
┌──────────────┬────────────────────────────────────────────┐
│ OptionsPanel │              Results Area                  │
│              │  ┌──────────────────────────────────────┐  │
│  [Mode]      │  │  Results Header                      │  │
│              │  │  h-9 bg-muted/30                     │  │
│  [Form       │  ├──────────────────────────────────────┤  │
│   Inputs]    │  │                                      │  │
│              │  │  Generated Results                   │  │
│  [Actions]   │  │  (Keys, Hashes, etc.)                │  │
│  - Generate  │  │                                      │  │
│  - Clear     │  │  flex-1 overflow-auto p-4            │  │
│              │  │                                      │  │
│  [Info]      │  └──────────────────────────────────────┘  │
└──────────────┴────────────────────────────────────────────┘
```

### Structure

```svelte
<script lang="ts">
	import { Key } from '@lucide/svelte';
	import { PageLayout } from '$lib/components/layout';
	import { ActionButton, CopyButton } from '$lib/components/action';
	import { FormInfo, FormInput, FormMode, FormSection, FormSelect } from '$lib/components/form';

	// Form state
	let password = $state('');
	let algorithm = $state('ed25519');

	// Result state
	let result = $state<Result | null>(null);
	let isGenerating = $state(false);

	const handleGenerate = async () => {
		// Generate logic
	};
</script>

<PageLayout valid={result ? true : null} bind:showOptions>
	{#snippet statusContent()}
		{#if result}
			<!-- Result stats -->
		{/if}
	{/snippet}

	{#snippet options()}
		<FormSection title="Mode">
			<FormMode value={mode} onchange={(v) => (mode = v)} options={modeOptions} />
		</FormSection>

		<FormSection title="Settings">
			<FormInput label="Password" bind:value={password} />
			<FormSelect label="Algorithm" bind:value={algorithm} options={algorithmOptions} />
		</FormSection>

		<FormSection title="Actions">
			<div class="space-y-2">
				<ActionButton label="Generate" icon={Key} loading={isGenerating} onclick={handleGenerate} />
				{#if result}
					<ActionButton label="Clear" variant="outline" onclick={handleClear} />
				{/if}
			</div>
		</FormSection>

		<FormSection title="About">
			<FormInfo>...</FormInfo>
		</FormSection>
	{/snippet}

	<!-- Results Panel -->
	<div class="flex h-full flex-col overflow-hidden">
		<div class="flex h-9 shrink-0 items-center border-b bg-muted/30 px-3">
			<span class="text-xs font-medium text-muted-foreground">Generated Result</span>
		</div>

		<div class="flex-1 overflow-auto p-4">
			{#if result}
				<!-- Result cards with CopyButton -->
			{:else if error}
				<!-- Error display -->
			{:else}
				<!-- Empty state with icon -->
			{/if}
		</div>
	</div>
</PageLayout>
```

### Pages Using This Pattern

- `src/routes/bcrypt-generator/+page.svelte`
- `src/routes/ssh-key-generator/+page.svelte`
- `src/routes/gpg-key-generator/+page.svelte`

---

## Common Components Reference

### CodeEditor Props

| Prop             | Type                                            | Description           |
| ---------------- | ----------------------------------------------- | --------------------- |
| `title`          | `string`                                        | Panel header title    |
| `value`          | `string`                                        | Editor content        |
| `onchange`       | `(v: string) => void`                           | Value change handler  |
| `mode`           | `'input' \| 'readonly'`                         | Editor mode           |
| `editorMode`     | `'json' \| 'sql' \| 'xml' \| 'yaml' \| 'plain'` | Syntax highlighting   |
| `placeholder`    | `string`                                        | Placeholder text      |
| `showViewToggle` | `boolean`                                       | Show tree/text toggle |
| `onpaste`        | `() => void`                                    | Paste button handler  |
| `onclear`        | `() => void`                                    | Clear button handler  |
| `onsample`       | `() => void`                                    | Sample button handler |
| `oncopy`         | `() => void`                                    | Copy button handler   |

### Form Components

| Component      | Usage                                              |
| -------------- | -------------------------------------------------- |
| `FormSection`  | Container with collapsible title                   |
| `FormMode`     | Mode toggle buttons (encode/decode, format/minify) |
| `FormSelect`   | Dropdown select                                    |
| `FormInput`    | Text input with optional password toggle           |
| `FormCheckbox` | Checkbox with label                                |
| `FormSlider`   | Slider with value display                          |
| `FormInfo`     | Info panel with icon                               |

### Action Components

| Component      | Usage                                    |
| -------------- | ---------------------------------------- |
| `ActionButton` | Primary action button with loading state |
| `CopyButton`   | Copy to clipboard with toast feedback    |

---

## Pattern Selection Guide

| Use Case                                 | Pattern |
| ---------------------------------------- | ------- |
| Multi-format tool with shared data       | A       |
| Multi-feature tool with independent data | B       |
| Simple encoder/formatter                 | C       |
| Parser/decoder with structured output    | D       |
| Generator with form input                | E       |

### Decision Tree

1. **Does the tool have multiple tabs?**
   - Yes → Continue to 2
   - No → Continue to 3

2. **Do tabs share input data?**
   - Yes → **Pattern A** (Tabbed + Shared Input)
   - No → **Pattern B** (Tabbed + Separate State)

3. **Does the tool have input/output transformation?**
   - Yes → **Pattern C** (OptionsPanel + SplitPane)
   - No → Continue to 4

4. **Does the tool analyze input and show structured results?**
   - Yes → **Pattern D** (OptionsPanel + Vertical Split)
   - No → **Pattern E** (OptionsPanel + Form Results)
