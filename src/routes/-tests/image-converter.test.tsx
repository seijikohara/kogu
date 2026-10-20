import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	convertMany,
	generateDemoImage,
	loadSource,
	type MultiConvertOutcome,
	type SourceImage,
} from '@/lib/services/image-convert';

import { Route } from '../image-converter';
import { renderRoute } from './render-route';

vi.mock('@/lib/components/editor', () => import('./code-editor-stub'));

vi.mock('@/lib/services/image-convert', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	loadSource: vi.fn<typeof loadSource>(),
	generateDemoImage: vi.fn<typeof generateDemoImage>(),
	convertMany: vi.fn<typeof convertMany>(),
}));

const createObjectURL = vi.fn<(blob: Blob) => string>();
const revokeObjectURL = vi.fn<(url: string) => void>();

interface PendingLoad {
	readonly file: File;
	readonly resolve: (source: SourceImage) => void;
}

const pendingLoads: PendingLoad[] = [];

const pngFile = (name: string) => new File(['png'], name, { type: 'image/png' });

const fakeSource = (file: File) => {
	const close = vi.fn<() => void>();
	const bitmap: ImageBitmap = { width: 4, height: 3, close };
	const source: SourceImage = {
		blob: file,
		bitmap,
		mime: file.type,
		width: bitmap.width,
		height: bitmap.height,
		bytes: file.size,
		filename: file.name,
	};
	return { file, source, close };
};

const pickFile = (container: HTMLElement, file: File) => {
	const input = container.querySelector('input[type="file"]');
	if (!(input instanceof HTMLInputElement)) throw new Error('File input not found');
	fireEvent.change(input, { target: { files: [file] } });
};

// Resolve the pending decodes of the given files within one act(), so React
// commits no state between them.
const settleLoads = async (...sources: readonly SourceImage[]) => {
	await act(async () => {
		for (const source of sources) {
			const pending = pendingLoads.find((p) => p.file === source.blob);
			if (!pending) throw new Error(`No pending load for ${source.filename}`);
			pending.resolve(source);
		}
		await Promise.resolve();
	});
};

const createdUrls = () => createObjectURL.mock.results.map((r) => String(r.value));
const revokedUrls = () => revokeObjectURL.mock.calls.map(([url]) => url);

describe('image converter source loading', () => {
	beforeEach(() => {
		pendingLoads.length = 0;
		let nextUrl = 0;
		createObjectURL.mockImplementation(() => {
			nextUrl += 1;
			return `blob:preview-${nextUrl}`;
		});
		// jsdom implements neither object URL function.
		Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
		Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
		vi.mocked(loadSource).mockImplementation(
			(file) =>
				new Promise<SourceImage>((resolve) => {
					pendingLoads.push({ file, resolve });
				})
		);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('creates the preview URL for a decoded image and revokes it on unmount', async () => {
		const { container, unmount } = await renderRoute(Route);
		const file = pngFile('a.png');
		pickFile(container, file);

		const { source, close } = fakeSource(file);
		await settleLoads(source);
		expect(createObjectURL).toHaveBeenCalledWith(file);
		expect(close).not.toHaveBeenCalled();

		unmount();
		expect(revokedUrls()).toEqual(['blob:preview-1']);
	});

	it('revokes the previous preview URL when a new image replaces it', async () => {
		const { container, unmount } = await renderRoute(Route);
		const first = fakeSource(pngFile('a.png'));
		const second = fakeSource(pngFile('b.png'));

		pickFile(container, first.file);
		await settleLoads(first.source);
		pickFile(container, second.file);
		await settleLoads(second.source);
		expect(revokedUrls()).toEqual(['blob:preview-1']);

		unmount();
		expect(revokedUrls()).toEqual(['blob:preview-1', 'blob:preview-2']);
	});

	it('keeps only the latest of two decodes that settle together', async () => {
		const { container, unmount } = await renderRoute(Route);
		const first = fakeSource(pngFile('a.png'));
		const second = fakeSource(pngFile('b.png'));
		pickFile(container, first.file);
		pickFile(container, second.file);

		await settleLoads(first.source, second.source);
		expect(createObjectURL).toHaveBeenCalledTimes(1);
		expect(createObjectURL).toHaveBeenCalledWith(second.file);
		expect(first.close).toHaveBeenCalledTimes(1);
		expect(second.close).not.toHaveBeenCalled();

		unmount();
		expect(revokedUrls()).toEqual(createdUrls());
	});

	it('discards a decode that finishes after the page unmounts', async () => {
		const { container, unmount } = await renderRoute(Route);
		const file = pngFile('a.png');
		pickFile(container, file);
		unmount();

		const { source, close } = fakeSource(file);
		await settleLoads(source);
		expect(createObjectURL).not.toHaveBeenCalled();
		expect(close).toHaveBeenCalledTimes(1);
	});

	it('revokes conversion results that arrive after the page unmounts', async () => {
		let resolveConvert: (outcomes: readonly MultiConvertOutcome[]) => void = () => undefined;
		vi.mocked(convertMany).mockImplementation(
			() =>
				new Promise<readonly MultiConvertOutcome[]>((resolve) => {
					resolveConvert = resolve;
				})
		);
		const { container, unmount } = await renderRoute(Route);
		const loaded = fakeSource(pngFile('a.png'));
		pickFile(container, loaded.file);
		await settleLoads(loaded.source);

		const convertButton = screen
			.getAllByRole('button')
			.find((button) => button.textContent?.trim().startsWith('Convert'));
		if (!convertButton) throw new Error('Convert button not found');
		fireEvent.click(convertButton);
		expect(convertMany).toHaveBeenCalledTimes(1);
		unmount();

		await act(async () => {
			resolveConvert([
				{
					format: 'png',
					ok: true,
					converted: {
						format: 'png',
						blob: loaded.file,
						url: 'blob:converted-png',
						bytes: loaded.file.size,
						width: 4,
						height: 3,
					},
				},
			]);
			await Promise.resolve();
		});
		expect(revokedUrls()).toContain('blob:converted-png');
	});

	describe('demo image', () => {
		let resolveDemo: (file: File) => void = () => undefined;

		beforeEach(() => {
			vi.mocked(generateDemoImage).mockImplementation(
				() =>
					new Promise<File>((resolve) => {
						resolveDemo = resolve;
					})
			);
		});

		const clickLoadDemo = () => {
			const [button] = screen.getAllByRole('button', { name: /load demo image/i });
			if (!button) throw new Error('Load demo image button not found');
			fireEvent.click(button);
		};

		const settleDemo = (file: File) =>
			act(async () => {
				resolveDemo(file);
				await Promise.resolve();
			});

		it('loads the generated demo image', async () => {
			await renderRoute(Route);
			clickLoadDemo();
			const demo = fakeSource(pngFile('demo.png'));
			await settleDemo(demo.file);
			await settleLoads(demo.source);
			expect(createObjectURL).toHaveBeenCalledWith(demo.file);
		});

		it('discards a demo image that is generated after the page unmounts', async () => {
			const { unmount } = await renderRoute(Route);
			clickLoadDemo();
			unmount();

			await settleDemo(pngFile('demo.png'));
			expect(loadSource).not.toHaveBeenCalled();
			expect(createObjectURL).not.toHaveBeenCalled();
		});
	});
});
