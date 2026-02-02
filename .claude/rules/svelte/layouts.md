# Page Layout Patterns

This document defines the standard layout patterns used in Kogu pages.

## Base Structure (All Pages)

Every page uses the `ToolShell` component (CSS Grid based):

```
┌─────────────────────────────────────────────────────────────┐
│                        TitleBar                             │
│  [Traffic Lights]              [Minimize] [Maximize] [Close]│
├──────────┬──────────────────────────────────────────────────┤
│          │                    ToolShell                      │
│          │ ┌──────────────────────────────────────────────┐ │
│ AppSide  │ │ ToolBar (h-12)                               │ │
│  bar     │ │  [Icon] Title  [Tabs...]                     │ │
│          │ ├──────────┬─────────────────────────────────┐ │
│  [Home]  │ │ Options  │                                  │ │
│  [JSON]  │ │  Rail    │        Main Content Area         │ │
│  [XML]   │ │ (w-64)   │                                  │ │
│  [YAML]  │ │          │    (varies by pattern below)     │ │
│  [SQL]   │ │          │                                  │ │
│  [...]   │ ├──────────┴─────────────────────────────────┤ │
│          │ │ StatusBar (h-7)   [Stats...]    [Validity]  │ │
│          │ └──────────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────────┘
```

### Required Imports

```svelte
<script lang="ts">
	import { ToolShell } from '$lib/components/shell';
	import { StatItem } from '$lib/components/status';
</script>
```

### Base Page Template

```svelte
<svelte:head>
	<title>Page Title - Kogu</title>
</svelte:head>

<ToolShell {valid} {error} bind:showRail={showOptions}>
	{#snippet statusContent()}
		<StatItem label="Chars" value={stats.chars} />
		<StatItem label="Size" value={stats.size} />
	{/snippet}

	{#snippet rail()}
		<FormSection title="Mode">...</FormSection>
		<FormSection title="Settings">...</FormSection>
	{/snippet}

	<!-- Main content area -->
</ToolShell>
```

### ToolShell Props

| Prop               | Type                                         | Default       | Description                        |
| ------------------ | -------------------------------------------- | ------------- | ---------------------------------- |
| `layout`           | `'tabbed' \| 'transform' \| 'master-detail'` | `'transform'` | Layout pattern                     |
| `title`            | `string`                                     | Auto from URL | Page title override                |
| `valid`            | `boolean \| null`                            | `undefined`   | Validation state                   |
| `error`            | `string`                                     | `undefined`   | Error message                      |
| `showRail`         | `boolean`                                    | `true`        | Options rail visibility (bindable) |
| `railTitle`        | `string`                                     | `'Options'`   | Rail header title                  |
| `tabs`             | `TabDefinition[]`                            | `undefined`   | Tab definitions                    |
| `activeTab`        | `string`                                     | `undefined`   | Active tab ID                      |
| `ontabchange`      | `(tab: string) => void`                      | `undefined`   | Tab change handler                 |
| `preserveTabState` | `boolean`                                    | `false`       | Keep tab content mounted           |

### ToolShell Snippets

| Snippet           | Description                                     |
| ----------------- | ----------------------------------------------- |
| `statusContent`   | Status bar content (StatItem components)        |
| `rail`            | Options rail content (FormSection components)   |
| `toolbarLeading`  | Custom toolbar left area                        |
| `toolbarCenter`   | Custom toolbar center (overrides tab rendering) |
| `toolbarTrailing` | Custom toolbar right area                       |
| `tabContent(tab)` | Tab content renderer (receives tab id)          |
| `children`        | Main content area (default slot)                |

---

## Pattern Overview

| Pattern      | Description          | Pages                                                                 |
| ------------ | -------------------- | --------------------------------------------------------------------- |
| Tabbed       | Multi-tab tools      | JSON, XML, YAML Formatter, URL Encoder                                |
| Transform    | Input → Output tools | Base64, SQL, Hash, JWT, BCrypt, SSH, GPG, String Case, Diff, Markdown |
| MasterDetail | List + detail view   | Network Scanner                                                       |

---

## Pattern: Tabbed

Multi-tab interface. Each tab manages its own content and options internally.

```
┌──────────────────────────────────────────────────────────────┐
│ ToolBar  [Icon] Title  [Format] [Query] [Compare] [Convert] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Tab Content (each tab has own OptionsPanel + content)       │
│  - Format Tab: OptionsPanel + SplitPane                      │
│  - Query Tab: OptionsPanel + Query Results                   │
│  - Compare Tab: Diff View                                    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ StatusBar  Keys: 42  Values: 120  Depth: 5  Size: 2.1 KB    │
└──────────────────────────────────────────────────────────────┘
```

### Structure

```svelte
<ToolShell layout="tabbed" {tabs} {activeTab} ontabchange={handleTabChange} valid={...} error={...} preserveTabState>
	{#snippet statusContent()}
		<StatItem label="Keys" value={stats.keys} />
	{/snippet}

	{#snippet tabContent(tab)}
		{#if tab === 'format'}
			<FormatTab input={sharedInput} onInputChange={setSharedInput} />
		{:else if tab === 'query'}
			<QueryTab input={sharedInput} onInputChange={setSharedInput} />
		{/if}
	{/snippet}
</ToolShell>
```

### Pages Using This Pattern

- `src/routes/json-formatter/+page.svelte`
- `src/routes/xml-formatter/+page.svelte`
- `src/routes/yaml-formatter/+page.svelte`
- `src/routes/url-encoder/+page.svelte`

---

## Pattern: Transform

Single-flow tools with options rail. Has sub-variants for content layout.

### Sub-variant: split-h (Horizontal Split)

```
┌──────────────────────────────────────────────────────────────┐
│ ToolBar  [Icon] Title                                        │
├──────────┬───────────────────┬───────────────────────────────┤
│ Options  │   CodeEditor      │    CodeEditor                 │
│  Rail    │   (Input)         │    (Output)                   │
│          │                   │                               │
│  [Mode]  │                   │                               │
│  [Opts]  │                   │                               │
├──────────┴───────────────────┴───────────────────────────────┤
│ StatusBar  Input: 42 chars  Output: 56 chars  Ratio: 1.33x   │
└──────────────────────────────────────────────────────────────┘
```

Pages: Base64 Encoder, SQL Formatter

### Sub-variant: split-v (Vertical Split)

```
┌──────────────────────────────────────────────────────────────┐
│ ToolBar  [Icon] Title                                        │
├──────────┬───────────────────────────────────────────────────┤
│ Options  │  CodeEditor (Input)  h-1/3                        │
│  Rail    ├───────────────────────────────────────────────────┤
│          │  SectionHeader "Results"                           │
│  [Info]  │  Results Content  flex-1 overflow-auto p-4        │
│  [Opts]  │                                                   │
├──────────┴───────────────────────────────────────────────────┤
│ StatusBar  Chars: 42  Size: 1.2 KB                           │
└──────────────────────────────────────────────────────────────┘
```

Pages: Hash Generator, JWT Decoder, String Case Converter

### Sub-variant: form-results

```
┌──────────────────────────────────────────────────────────────┐
│ ToolBar  [Icon] Title                                        │
├──────────┬───────────────────────────────────────────────────┤
│ Options  │  SectionHeader "Generated Result"                 │
│  Rail    │                                                   │
│          │  Results Content / EmptyState                      │
│  [Mode]  │                                                   │
│  [Form]  │                                                   │
│  [Action]│                                                   │
├──────────┴───────────────────────────────────────────────────┤
│ StatusBar                                                    │
└──────────────────────────────────────────────────────────────┘
```

Pages: BCrypt Generator, SSH Key Generator, GPG Key Generator

### Sub-variant: dual-view

Pages: Diff Viewer, Markdown Editor

---

## Pattern: MasterDetail

Options rail with resizable two-pane layout for list + detail view.

```
┌──────────────────────────────────────────────────────────────┐
│ ToolBar  [Icon] Title                                        │
├──────────┬────────────────────┬──────────────────────────────┤
│ Options  │    Host List       │    Host Detail Panel         │
│  Rail    │   (Resizable)      │      (Resizable)             │
│          │  ┌──────────────┐  │  ┌────────────────────────┐  │
│  [Target]│  │ Host Item 1  │  │  │ Host Info              │  │
│  [Disc.] │  │ Host Item 2  │  │  │ - IP addresses         │  │
│  [Ports] │  │ Host Item 3◄─┼──┼─▶│ - Ports/Services       │  │
│  [Action]│  └──────────────┘  │  └────────────────────────┘  │
├──────────┴────────────────────┴──────────────────────────────┤
│ StatusBar  Hosts: 5  Ports: 23  Duration: 3.2s               │
└──────────────────────────────────────────────────────────────┘
```

### Pages Using This Pattern

- `src/routes/network-scanner/+page.svelte`

---

## Shell Components Reference

### ToolShell (`src/lib/components/shell/tool-shell.svelte`)

CSS Grid layout with areas: toolbar, rail, content, status.

### ToolBar (`src/lib/components/shell/tool-bar.svelte`)

- Height: `h-12` (48px)
- Auto-detects page icon and title from URL
- Renders tabs when provided

### OptionsRail (`src/lib/components/shell/options-rail.svelte`)

- Width: `w-64` (256px), collapsed: `w-10` (40px)
- Uses `ScrollArea` for content overflow
- Background: `bg-surface-2`
- Border: `border-r border-border/60`

### StatusBar (`src/lib/components/shell/status-bar.svelte`)

- Height: `h-7` (28px)
- Shows StatItem components and ValidityBadge
- Background: `bg-surface-2 border-t`

---

## Common Components Reference

### Form Components

| Component      | Usage                         |
| -------------- | ----------------------------- |
| `FormSection`  | Collapsible section container |
| `FormMode`     | Mode toggle buttons           |
| `FormSelect`   | Dropdown select               |
| `FormInput`    | Text input                    |
| `FormCheckbox` | Checkbox with label           |
| `FormSlider`   | Slider with value display     |
| `FormInfo`     | Info panel                    |

### Status Components

| Component        | Usage                                  |
| ---------------- | -------------------------------------- |
| `StatItem`       | Label + value display in StatusBar     |
| `EmptyState`     | Empty state with icon and message      |
| `ErrorDisplay`   | Error display (inline/centered/banner) |
| `SectionHeader`  | Section header with optional count     |
| `LoadingOverlay` | Loading overlay with progress          |

### Action Components

| Component      | Usage                                    |
| -------------- | ---------------------------------------- |
| `ActionButton` | Primary action button with loading state |
| `CopyButton`   | Copy to clipboard with toast             |
| `ResultBlock`  | Result display with copy button          |

---

## Design Tokens

### Surface Hierarchy

| Token       | Usage                                       |
| ----------- | ------------------------------------------- |
| `surface-1` | Page background (= `background`)            |
| `surface-2` | Rail, StatusBar, card background (= `card`) |
| `surface-3` | Muted areas (= `muted`)                     |
| `surface-4` | Emphasized surfaces                         |

### Semantic Colors

| Token         | Usage                           |
| ------------- | ------------------------------- |
| `success`     | Valid states, secure indicators |
| `warning`     | Weak/deprecated indicators      |
| `info`        | Informational highlights        |
| `destructive` | Errors, invalid states          |

### Typography

| Class      | Size | Usage                 |
| ---------- | ---- | --------------------- |
| `text-2xs` | 10px | Tiny labels, badges   |
| `text-xs`  | 12px | Secondary info, hints |
| `text-sm`  | 14px | Body text, tab labels |

---

## Pattern Selection Guide

| Use Case                       | Pattern                  |
| ------------------------------ | ------------------------ |
| Multi-format tool with tabs    | Tabbed                   |
| Simple encoder/formatter       | Transform (split-h)      |
| Parser with structured results | Transform (split-v)      |
| Generator with form input      | Transform (form-results) |
| Preview/comparison             | Transform (dual-view)    |
| List + detail navigation       | MasterDetail             |
