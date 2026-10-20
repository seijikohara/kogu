import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateAllHashes } from '@/lib/services/encoders';

import { Route } from '../hash-generator';
import { renderRoute } from './render-route';

vi.mock('@/lib/components/editor', () => import('./code-editor-stub'));

vi.mock('@/lib/services/encoders', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	generateAllHashes: vi.fn<typeof generateAllHashes>(),
}));

type HashResults = Awaited<ReturnType<typeof generateAllHashes>>;

interface PendingHash {
	readonly text: string;
	readonly resolve: (results: HashResults) => void;
}

const pending: PendingHash[] = [];

// Longer than the 150 ms input debounce of the text tab.
const waitForDebounce = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 200)));

const hashOf = (text: string) => `hash-of-${text}`;

const resolveHash = async (text: string) => {
	const entry = pending.find((p) => p.text === text);
	if (!entry) throw new Error(`No pending hash for "${text}"`);
	await act(async () => {
		entry.resolve([{ algorithm: 'SHA256', hash: hashOf(text), bits: 256 }]);
		await Promise.resolve();
	});
};

const typeText = (text: string) =>
	fireEvent.change(screen.getByLabelText('Input Text'), { target: { value: text } });

// jsdom has no Clipboard API; the Paste action only needs `readText`.
const stubClipboardText = (text: string) =>
	Object.defineProperty(navigator, 'clipboard', {
		configurable: true,
		value: { readText: () => Promise.resolve(text) },
	});

const renderPage = () => renderRoute(Route);

describe('hash generator text tab', () => {
	beforeEach(() => {
		pending.length = 0;
		vi.mocked(generateAllHashes).mockImplementation(
			(text) =>
				new Promise<HashResults>((resolve) => {
					pending.push({ text, resolve });
				})
		);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('does not show the previous hashes after a blank paste', async () => {
		stubClipboardText('   ');
		await renderPage();

		typeText('A');
		await waitForDebounce();
		await resolveHash('A');
		expect(screen.queryByText(hashOf('A'))).not.toBeNull();

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Paste' }));
			await Promise.resolve();
		});
		await waitForDebounce();
		expect(screen.queryByText(hashOf('A'))).toBeNull();

		typeText('B');
		await waitForDebounce();
		expect(screen.queryByText(hashOf('A'))).toBeNull();

		await resolveHash('B');
		expect(screen.queryByText(hashOf('B'))).not.toBeNull();
	});

	it('does not show hashes that settle while Clear is debounced', async () => {
		await renderPage();

		typeText('A');
		await waitForDebounce();
		fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
		await resolveHash('A');
		await waitForDebounce();
		expect(screen.queryByText(hashOf('A'))).toBeNull();

		typeText('B');
		await waitForDebounce();
		expect(screen.queryByText(hashOf('A'))).toBeNull();

		await resolveHash('B');
		expect(screen.queryByText(hashOf('B'))).not.toBeNull();
	});

	it('keeps the previous hashes visible while the next non-blank input is hashed', async () => {
		await renderPage();

		typeText('A');
		await waitForDebounce();
		await resolveHash('A');

		typeText('AB');
		await waitForDebounce();
		expect(screen.queryByText(hashOf('A'))).not.toBeNull();

		await resolveHash('AB');
		expect(screen.queryByText(hashOf('AB'))).not.toBeNull();
	});
});
