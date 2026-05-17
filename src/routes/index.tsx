import { Link, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
	component: HomePage,
});

const TOOLS = [
	{ slug: '/base64-encoder', name: 'Base64 Encoder' },
	{ slug: '/bcrypt-generator', name: 'BCrypt Generator' },
	{ slug: '/cron-expression-builder', name: 'Cron Expression Builder' },
	{ slug: '/curl-builder', name: 'cURL Builder' },
	{ slug: '/diff-viewer', name: 'Diff Viewer' },
	{ slug: '/gpg-key-generator', name: 'GPG Key Generator' },
	{ slug: '/hash-generator', name: 'Hash Generator' },
	{ slug: '/json-formatter', name: 'JSON Formatter' },
	{ slug: '/jwt-decoder', name: 'JWT Decoder' },
	{ slug: '/markdown-editor', name: 'Markdown Editor' },
	{ slug: '/network-interfaces', name: 'Network Interfaces' },
	{ slug: '/network-scanner', name: 'Network Scanner' },
	{ slug: '/password-generator', name: 'Password Generator' },
	{ slug: '/qr-code-generator', name: 'QR Code Generator' },
	{ slug: '/regex-tester', name: 'Regex Tester' },
	{ slug: '/settings', name: 'Settings' },
	{ slug: '/sql-formatter', name: 'SQL Formatter' },
	{ slug: '/ssh-key-generator', name: 'SSH Key Generator' },
	{ slug: '/string-case-converter', name: 'String Case Converter' },
	{ slug: '/url-encoder', name: 'URL Encoder' },
	{ slug: '/uuid-generator', name: 'UUID Generator' },
	{ slug: '/xml-formatter', name: 'XML Formatter' },
	{ slug: '/yaml-formatter', name: 'YAML Formatter' },
] as const;

function HomePage() {
	// import.meta.env.DEV is replaced at build time by Vite, so the link tree-shakes out of
	// production bundles. The route file itself stays in the tree until Phase 6 cleanup.
	const isDev = import.meta.env.DEV;

	return (
		<div className="mx-auto max-w-3xl space-y-4">
			<h2 className="text-xl font-medium">Tools</h2>
			<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{TOOLS.map((tool) => (
					<li key={tool.slug}>
						<Link to={tool.slug} className="block rounded border px-3 py-2 text-sm hover:bg-muted">
							{tool.name}
						</Link>
					</li>
				))}
			</ul>
			{isDev ? (
				<div className="pt-2 text-xs text-muted-foreground">
					<Link to="/primitives" className="underline-offset-4 hover:underline">
						→ Primitive gallery (dev)
					</Link>
				</div>
			) : null}
		</div>
	);
}
