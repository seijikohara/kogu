---
paths:
  [
    'src/routes/**/*.tsx',
    'src/lib/components/layout/**/*.tsx',
    'src/lib/components/shell/**/*.tsx',
    'src/lib/components/template/**/*.tsx',
  ]
---

# Page Layout Patterns

## Shell hierarchy

Every tool route renders inside the same chrome:

```
__root.tsx
└─ <AppSidebar />          (left nav)
   <TitleBar />            (window controls + command palette trigger)
   <main>
     <route component>     (your tool page renders here)
   </main>
```

Inside a tool route, prefer the `ToolShell` template instead of building your own toolbar / rail / status-bar trio:

```tsx
import { ToolShell } from '@/lib/components/shell';
import { StatItem } from '@/lib/components/status';
import { FormSection, FormInput } from '@/lib/components/form';

export function MyToolPage() {
	const [value, setValue] = useState('');
	const [showRail, setShowRail] = useState(true);

	return (
		<ToolShell
			showRail={showRail}
			onShowRailChange={setShowRail}
			rail={
				<FormSection title="Options">
					<FormInput label="Input" value={value} onValueChange={setValue} />
				</FormSection>
			}
			statusContent={<StatItem label="Length" value={value.length} />}
		>
			{/* main content */}
		</ToolShell>
	);
}
```

`ToolShell` accepts:

- `valid` — `true | false | null` to drive the status-bar validity badge.
- `error` — string to display in the status bar's error slot.
- `showRail` / `onShowRailChange` / `defaultShowRail` — controlled / uncontrolled rail visibility.
- Named slot props: `toolbarLeading`, `center`, `rail`, `statusContent`.
- `tabs` + `renderTabContent` for routes that need internal tabs (formatter family).

## Formatter family

Tools that share format / compare / convert / query / schema / generate tabs use `TabbedFormatterPage` instead of `ToolShell` directly:

```tsx
import { TabbedFormatterPage } from '@/lib/components/template';
import { useFormatterPage } from '@/lib/hooks/use-formatter-page';

export function XmlFormatterPage() {
	return (
		<TabbedFormatterPage
			title="XML Formatter"
			calculateStats={calculateXmlStats}
			persistKey="xml-formatter"
			renderStatusContent={(stats) => <XmlStatItems stats={stats} />}
			renderTabContent={({ tab, input, onInputChange, onStatsChange }) => {
				if (tab === 'format')
					return (
						<FormatTab input={input} onInputChange={onInputChange} onStatsChange={onStatsChange} />
					);
				if (tab === 'query')
					return (
						<QueryTab input={input} onInputChange={onInputChange} onStatsChange={onStatsChange} />
					);
				// …
			}}
		/>
	);
}
```

The `persistKey` ties tab selection to the Zustand `useTabStore` so the active tab survives reloads.

## Sidebar & title bar

The chrome (`<AppSidebar />` + `<TitleBar />`) is mounted in `src/routes/__root.tsx` and is **not** something individual routes manage. `useSidebarStore` carries:

- `collapsed` / `setCollapsed` / `toggleCollapsed`
- `openGroups` / `toggleGroup` / `setGroupOpen`

Routes consume the store only when they specifically need to drive the sidebar from inside their content (rare).

## Form rhythm

Compose tool rails out of `FormSection` containers with `Form*` wrappers inside:

```tsx
<FormSection title="Options">
	<FormInput label="Name" value={name} onValueChange={setName} />
	<FormSelect label="Mode" value={mode} onValueChange={setMode} options={MODE_OPTIONS} />
	<FormCheckboxGroup>
		<FormCheckbox label="Verbose" checked={verbose} onCheckedChange={setVerbose} />
		<FormCheckbox label="Strict" checked={strict} onCheckedChange={setStrict} />
	</FormCheckboxGroup>
</FormSection>
```

`FormSection` is collapsible by default (`defaultOpen=true`). For nested groups inside a section use `FormCheckboxGroup` to collapse the gap from 12px to 6px.

## Persisted state

| Need                                   | Hook                                                     |
| -------------------------------------- | -------------------------------------------------------- |
| Active tab on a tabbed formatter route | `useActiveTab(key)` / `useTabStore` (`@/lib/stores`)     |
| Per-route tool options                 | `createToolOptionsStore('<route-id>', defaults)` factory |
| Sidebar collapsed / group open state   | `useSidebarStore` (`@/lib/stores/sidebar`)               |
| Cross-device user settings (TOML)      | Tauri `settings.ts` service                              |

Per-session state (input value, results, transient flash counters) stays local with `useState`.

## Inline section labels

For inline labels above content cards inside a panel, prefer `SectionLabel` over a hand-rolled `<h3>`:

```tsx
<SectionLabel icon={Globe}>IP Addresses</SectionLabel>
<div className="rounded-lg border bg-card p-3">…</div>
```

State-colored icons use `iconClass`:

```tsx
<SectionLabel icon={CheckCircle2} iconClass="h-4 w-4 text-success">
	Open Ports ({openPorts.length})
</SectionLabel>
```

## Embedded empty states

For empty states inside a tab panel or card, use `EmbeddedEmptyState` (not the full-page `EmptyState`):

```tsx
<EmbeddedEmptyState
	icon={Network}
	title="No Port Scan Data"
	description="Select a scan mode and run a port scan to detect open services."
	fillHeight
/>
```

`fillHeight` makes the empty state occupy the parent's full height (typical for tab panels).

## User feedback

Use `sonner` for transient notifications:

```tsx
import { toast } from 'sonner';

toast.success('Copied to clipboard');
toast.error('Failed to parse JSON', { description: 'Invalid syntax at line 5' });
```

The provider is mounted once in `__root.tsx` via `<Toaster />` from `@/lib/components/ui/sonner`. Do not mount additional providers per route.
