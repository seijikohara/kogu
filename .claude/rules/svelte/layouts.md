---
paths: '{src/routes/**/*.svelte,src/lib/components/{shell,layout,form,status,panel,editor}/**/*.svelte}'
---

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
│  [XML]   │ │(rail-w)  │                                  │ │
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

## Pattern: ReactiveSinglePage

Single-input tool with multiple synchronized views of the same underlying state. Inspired by `regex101.com` — one source-of-truth input at the top, with derived panels (matches, replacements, structural visualization, explanation) updating reactively.

```
┌──────────────────────────────────────────────────────────────┐
│ ToolBar  [Icon] Title                                        │
├──────────┬───────────────────────────────────────────────────┤
│ Options  │ Pattern bar (sticky)                              │
│  Rail    │ ┌─────────────────────────┐ [g][i][m][s][u][y]   │
│          │ │ Syntax-highlighted input │ flag pills           │
│  [Info]  │ └─────────────────────────┘                        │
│  [Help]  │ ✓ valid · stats · features                        │
│          ├──────────────────────────┬────────────────────────┤
│          │ Primary input + action   │ Side accordion         │
│          │  ┌────────────────────┐  │  ▼ Section 1           │
│          │  │ Test input         │  │  ▼ Section 2           │
│          │  │ Inline preview     │  │  ▼ Section 3           │
│          │  └────────────────────┘  │                        │
│          │  ┌────────────────────┐  │                        │
│          │  │ Action toggle      │  │                        │
│          │  │ Result preview     │  │                        │
│          │  └────────────────────┘  │                        │
├──────────┴──────────────────────────┴────────────────────────┤
│ StatusBar  ...                                               │
└──────────────────────────────────────────────────────────────┘
```

Distinguishing features:

- **Single source of truth at the top** — pattern, query, or expression. All derived views read from this.
- **Live reactive updates** — no Generate button. Edits propagate immediately to all panels.
- **Two-column body** — left for the user's working area (test text + secondary action), right for collapsible analytical panels.
- **Accordion side panel** — multiple viewpoints (Matches / Structure / Explain) collapse independently.
- **Flag/option pills next to the input** — compact toggles instead of a dedicated options card.

### When to Use

Pick this pattern when:

- The tool centers on a single complex input (regex, query, expression)
- Users iterate fast and benefit from seeing all derived views simultaneously
- Match/Replace style "modes" exist that share input but produce different outputs

### Pages Using This Pattern

- `src/routes/regex-tester/+page.svelte`

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

- Width: `var(--rail-w)` (288px), collapsed: `var(--rail-w-collapsed)` (44px)
- Uses `ScrollArea` for content overflow
- Background: `bg-sidebar`
- Border: `border-r border-border/50`
- Toggle interaction: edge-strip hit zone hugging the aside's right border
  (mirrors the shadcn `SidebarRail` pattern). Hover surfaces a 2px vertical
  accent line; `cursor-w-resize` when open, `cursor-e-resize` when collapsed.
  In the collapsed state a `Settings2` icon button is also rendered as the
  primary expand affordance because the narrow strip is too small to target
  the edge-strip reliably.

### Width Tokens

| Token                | Value   | Usage                                                             |
| -------------------- | ------- | ----------------------------------------------------------------- |
| `--rail-w`           | 18rem   | Standard options rail width (OptionsRail, OptionsPanel)           |
| `--rail-w-wide`      | 24rem   | Wide analytical panel (ReactiveSinglePage right accordion column) |
| `--rail-w-collapsed` | 2.75rem | Collapsed-state width for any rail-like aside                     |

### StatusBar (`src/lib/components/shell/status-bar.svelte`)

- Height: `h-7` (28px)
- Shows StatItem components and ValidityBadge
- Background: `bg-surface-2 border-t`

---

## Common Components Reference

### Form Components

| Component           | Usage                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| `FormSection`       | Collapsible section container (12px gap between children)                     |
| `FormCheckboxGroup` | Wrapper for two or more `FormCheckbox` (collapses gap to 6px for dense lists) |
| `FormMode`          | Mode toggle buttons                                                           |
| `FormSelect`        | Dropdown select                                                               |
| `FormInput`         | Text input                                                                    |
| `FormCheckbox`      | Checkbox with label                                                           |
| `FormSlider`        | Slider with value display                                                     |
| `FormInfo`          | Info panel                                                                    |

### Layout Components

| Component       | Usage                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| `SectionHeader` | Bordered, surface-2 panel header (top of a content panel)                |
| `SectionLabel`  | Inline section label above a content card (lighter than `SectionHeader`) |
| `SplitPane`     | Resizable two-pane layout                                                |

### Status Components

| Component            | Usage                                                                |
| -------------------- | -------------------------------------------------------------------- |
| `StatItem`           | Label + value display in StatusBar                                   |
| `EmptyState`         | Full-page empty state with large (16x16) icon                        |
| `EmbeddedEmptyState` | Compact empty state for tab panels and cards (`fillHeight` optional) |
| `ErrorDisplay`       | Error display (inline/centered/banner)                               |
| `LoadingOverlay`     | Loading overlay with progress                                        |

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

| Use Case                                     | Pattern                  |
| -------------------------------------------- | ------------------------ |
| Multi-format tool with tabs                  | Tabbed                   |
| Simple encoder/formatter                     | Transform (split-h)      |
| Parser with structured results               | Transform (split-v)      |
| Generator with form input                    | Transform (form-results) |
| Preview/comparison                           | Transform (dual-view)    |
| Single complex input with synchronized views | ReactiveSinglePage       |
| List + detail navigation                     | MasterDetail             |

## Pattern Overview Table

| Pattern            | Tabs?    | Rail?    | Body layout                  | Card system                        |
| ------------------ | -------- | -------- | ---------------------------- | ---------------------------------- |
| Tabbed (Formatter) | Required | No       | OptionsPanel + SplitPane     | OptionsPanel chrome (editor-heavy) |
| Tabbed (General)   | Required | Optional | Tab content panels           | `Card.Root`                        |
| Transform          | No       | Required | Single split                 | `Card.Root`                        |
| ReactiveSinglePage | No       | Optional | Pattern bar + 2-col + accord | `Card.Root`                        |
| MasterDetail       | No       | Required | Resizable list + detail      | `Card.Root`                        |

Every pattern uses **`Card.Root` for sectioned content**, with one principled exception:

- **Tabbed (Formatter)** — JSON / YAML / XML / URL Encoder formatter tabs are editor-heavy: the canonical body is a `CodeEditor` (or two via `SplitPane`) with an `OptionsPanel` (project-owned shell component) on the left. The OptionsPanel uses `bg-surface-2` and stacks `FormSection`s; cards inside the editor pane would compete with the editor for visual weight. This is a deliberate divergence — see the `useFormatterPage` hook + `OptionsPanel` for the shared infrastructure.

For all other patterns, the legacy `<div class="rounded-lg border bg-surface-3 ...">` ad-hoc card is deprecated in favor of the shadcn primitive — see `components.md` § Container Patterns for the canonical mapping.
