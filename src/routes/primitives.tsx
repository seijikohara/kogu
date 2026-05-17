import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Bell, Check, ChevronRight, Info, Plus, Settings2, Trash2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/lib/components/ui/alert';
import { Badge } from '@/lib/components/ui/badge';
import { Button } from '@/lib/components/ui/button';
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/lib/components/ui/card';
import { Checkbox } from '@/lib/components/ui/checkbox';
import { CollapsibleAside } from '@/lib/components/ui/collapsible-aside';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { ListItemButton } from '@/lib/components/ui/list-item-button';
import { Progress } from '@/lib/components/ui/progress';
import { ScrollArea } from '@/lib/components/ui/scroll-area';
import { Separator } from '@/lib/components/ui/separator';
import { Skeleton } from '@/lib/components/ui/skeleton';
import { Slider } from '@/lib/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/components/ui/tabs';
import { Textarea } from '@/lib/components/ui/textarea';
import { Toggle } from '@/lib/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/lib/components/ui/toggle-group';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/lib/components/ui/tooltip';

export const Route = createFileRoute('/primitives')({
	component: PrimitivesGallery,
});

function Section({
	title,
	children,
}: {
	readonly title: string;
	readonly children: React.ReactNode;
}) {
	return (
		<section className="space-y-3">
			<h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
			<div className="flex flex-wrap items-start gap-3 rounded-lg border border-border/40 bg-surface-1 p-4">
				{children}
			</div>
		</section>
	);
}

function PrimitivesGallery() {
	const [sliderValue, setSliderValue] = useState<readonly number[]>([42]);
	const [progressValue, setProgressValue] = useState(33);
	const [checked, setChecked] = useState(true);
	const [toggle, setToggle] = useState(false);
	const [toggleGroup, setToggleGroup] = useState<string>('left');
	const [listSelected, setListSelected] = useState<string>('opt-2');

	return (
		<TooltipProvider>
			<div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
				<header className="flex items-end justify-between border-b border-border/40 pb-4">
					<div>
						<h1 className="text-xl font-semibold tracking-tight">Primitive Gallery</h1>
						<p className="text-sm text-muted-foreground">
							Visual parity check for shadcn-svelte → shadcn React port (Phase 2).
						</p>
					</div>
					<Link to="/" className="text-sm text-primary underline-offset-4 hover:underline">
						← Home
					</Link>
				</header>

				<Section title="Button (variants × sizes)">
					<Button>Default</Button>
					<Button variant="secondary">Secondary</Button>
					<Button variant="outline">Outline</Button>
					<Button variant="ghost">Ghost</Button>
					<Button variant="destructive">Destructive</Button>
					<Button variant="link">Link</Button>
					<Button size="xs">xs</Button>
					<Button size="sm">sm</Button>
					<Button size="lg">lg</Button>
					<Button size="icon" aria-label="add">
						<Plus />
					</Button>
					<Button size="icon-sm" aria-label="settings">
						<Settings2 />
					</Button>
					<Button disabled>Disabled</Button>
				</Section>

				<Section title="Badge">
					<Badge>Default</Badge>
					<Badge variant="secondary">Secondary</Badge>
					<Badge variant="outline">Outline</Badge>
					<Badge variant="destructive">Destructive</Badge>
				</Section>

				<Section title="Form controls">
					<div className="grid w-full max-w-md gap-3">
						<div className="grid gap-1.5">
							<Label htmlFor="demo-input">Input</Label>
							<Input id="demo-input" placeholder="placeholder text" />
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="demo-textarea">Textarea</Label>
							<Textarea id="demo-textarea" placeholder="multi-line" rows={3} />
						</div>
						<div className="flex items-center gap-2">
							<Checkbox
								id="demo-check"
								checked={checked}
								onCheckedChange={(v) => setChecked(v === true)}
							/>
							<Label htmlFor="demo-check">Checkbox</Label>
						</div>
						<div className="grid gap-1.5">
							<Label>Slider — {sliderValue[0]}</Label>
							<Slider
								value={[...sliderValue]}
								onValueChange={(v) => setSliderValue(v)}
								min={0}
								max={100}
								step={1}
							/>
						</div>
						<div className="grid gap-1.5">
							<Label>Progress — {progressValue}%</Label>
							<Progress value={progressValue} />
							<div className="flex gap-2">
								<Button
									size="xs"
									variant="outline"
									onClick={() => setProgressValue((v) => Math.max(0, v - 10))}
								>
									-10
								</Button>
								<Button
									size="xs"
									variant="outline"
									onClick={() => setProgressValue((v) => Math.min(100, v + 10))}
								>
									+10
								</Button>
							</div>
						</div>
					</div>
				</Section>

				<Section title="Toggle / ToggleGroup">
					<Toggle pressed={toggle} onPressedChange={setToggle} aria-label="toggle">
						<Bell />
					</Toggle>
					<ToggleGroup
						type="single"
						value={toggleGroup}
						onValueChange={(v) => v && setToggleGroup(v)}
						aria-label="alignment"
					>
						<ToggleGroupItem value="left">Left</ToggleGroupItem>
						<ToggleGroupItem value="center">Center</ToggleGroupItem>
						<ToggleGroupItem value="right">Right</ToggleGroupItem>
					</ToggleGroup>
				</Section>

				<Section title="Card (default + compact density)">
					<Card className="w-72">
						<CardHeader>
							<CardTitle>Default density</CardTitle>
							<CardDescription>gap-4, py-4, px-4</CardDescription>
							<CardAction>
								<Button size="icon-sm" variant="ghost" aria-label="more">
									<ChevronRight />
								</Button>
							</CardAction>
						</CardHeader>
						<CardContent>Body content lives here.</CardContent>
						<CardFooter>
							<Button size="sm">Action</Button>
						</CardFooter>
					</Card>
					<Card className="w-72" density="compact">
						<CardHeader>
							<CardTitle>Compact density</CardTitle>
							<CardDescription>gap-3, py-3, px-3</CardDescription>
						</CardHeader>
						<CardContent>Body content lives here.</CardContent>
						<CardFooter>
							<Button size="sm">Action</Button>
						</CardFooter>
					</Card>
				</Section>

				<Section title="Alert">
					<Alert className="w-full max-w-md">
						<Info />
						<AlertTitle>Heads up</AlertTitle>
						<AlertDescription>This is an informational alert with an icon slot.</AlertDescription>
					</Alert>
					<Alert variant="destructive" className="w-full max-w-md">
						<Trash2 />
						<AlertTitle>Destructive</AlertTitle>
						<AlertDescription>Something went wrong.</AlertDescription>
					</Alert>
				</Section>

				<Section title="Tabs">
					<Tabs defaultValue="one" className="w-full max-w-md">
						<TabsList>
							<TabsTrigger value="one">One</TabsTrigger>
							<TabsTrigger value="two">Two</TabsTrigger>
							<TabsTrigger value="three">Three</TabsTrigger>
						</TabsList>
						<TabsContent value="one">First panel</TabsContent>
						<TabsContent value="two">Second panel</TabsContent>
						<TabsContent value="three">Third panel</TabsContent>
					</Tabs>
				</Section>

				<Section title="Tooltip">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="outline">Hover me</Button>
						</TooltipTrigger>
						<TooltipContent>Tooltip content</TooltipContent>
					</Tooltip>
				</Section>

				<Section title="Skeleton">
					<div className="w-full max-w-md space-y-2">
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-4 w-1/2" />
						<Skeleton className="h-24 w-full" />
					</div>
				</Section>

				<Section title="Separator">
					<div className="flex w-full max-w-md flex-col gap-2">
						<span>Above</span>
						<Separator />
						<span>Below</span>
					</div>
				</Section>

				<Section title="ScrollArea">
					<ScrollArea className="h-40 w-full max-w-md rounded-md border border-border/40 p-3">
						<ul className="space-y-1 text-sm">
							{Array.from({ length: 30 }, (_, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static gallery list, items never reorder
								<li key={i}>Scrollable item {i + 1}</li>
							))}
						</ul>
					</ScrollArea>
				</Section>

				<Section title="ListItemButton (Kogu original, 5 variants)">
					<div className="w-full max-w-md space-y-3">
						<div className="rounded-md border border-border/40">
							<ListItemButton
								variant="option"
								role="option"
								selected={listSelected === 'opt-1'}
								onClick={() => setListSelected('opt-1')}
								leading={<Check />}
							>
								Option one
							</ListItemButton>
							<ListItemButton
								variant="option"
								role="option"
								selected={listSelected === 'opt-2'}
								onClick={() => setListSelected('opt-2')}
								leading={<Check />}
							>
								Option two (selected)
							</ListItemButton>
							<ListItemButton
								variant="option"
								role="option"
								selected={listSelected === 'opt-3'}
								onClick={() => setListSelected('opt-3')}
								leading={<Check />}
							>
								Option three
							</ListItemButton>
						</div>
						<div className="flex flex-col gap-1">
							<ListItemButton variant="tree-node" depth={0} role="treeitem">
								root
							</ListItemButton>
							<ListItemButton variant="tree-node" depth={1} role="treeitem">
								child
							</ListItemButton>
							<ListItemButton variant="tree-node" depth={2} role="treeitem" selected>
								grandchild (selected)
							</ListItemButton>
						</div>
						<ListItemButton variant="card">card variant</ListItemButton>
						<ListItemButton variant="toc">toc variant</ListItemButton>
					</div>
				</Section>

				<Section title="CollapsibleAside (Kogu original)">
					<div className="flex h-64 w-full max-w-md overflow-hidden rounded-md border border-border/40">
						<CollapsibleAside title="Demo options" width="w-56">
							<div className="space-y-2 px-3 text-sm">
								<p className="font-medium">Aside content</p>
								<p className="text-muted-foreground">
									Click the right-edge rail to collapse; the icon button restores it.
								</p>
							</div>
						</CollapsibleAside>
						<div className="flex-1 bg-surface-1 p-4 text-sm text-muted-foreground">Main panel</div>
					</div>
				</Section>
			</div>
		</TooltipProvider>
	);
}
