import { act, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadSource, type SourceImage } from '@/lib/services/image-convert';

import { Route } from '../image-converter';
import { renderRoute } from './render-route';

vi.mock('@/lib/components/editor', () => import('./code-editor-stub'));

vi.mock('@/lib/services/image-convert', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	loadSource: vi.fn<typeof loadSource>(),
}));

const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:preview');
const revokeObjectURL = vi.fn<(url: string) => void>();

const pendingLoads: ((source: SourceImage) => void)[] = [];

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
	return { source, close };
};

const pickFile = (container: HTMLElement, file: File) => {
	const input = container.querySelector('input[type="file"]');
	if (!(input instanceof HTMLInputElement)) throw new Error('File input not found');
	fireEvent.change(input, { target: { files: [file] } });
};

const settleLoad = async (source: SourceImage) => {
	const resolve = pendingLoads.shift();
	if (!resolve) throw new Error('No pending load');
	await act(async () => {
		resolve(source);
		await Promise.resolve();
	});
};

describe('image converter source loading', () => {
	beforeEach(() => {
		pendingLoads.length = 0;
		// jsdom implements neither object URL function.
		Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
		Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
		vi.mocked(loadSource).mockImplementation(
			() =>
				new Promise<SourceImage>((resolve) => {
					pendingLoads.push(resolve);
				})
		);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('creates the preview URL for a decoded image and revokes it on unmount', async () => {
		const { container, unmount } = await renderRoute(Route);
		const file = new File(['png'], 'a.png', { type: 'image/png' });
		pickFile(container, file);

		const { source, close } = fakeSource(file);
		await settleLoad(source);
		expect(createObjectURL).toHaveBeenCalledWith(file);
		expect(close).not.toHaveBeenCalled();

		unmount();
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview');
	});

	it('discards a decode that finishes after the page unmounts', async () => {
		const { container, unmount } = await renderRoute(Route);
		const file = new File(['png'], 'a.png', { type: 'image/png' });
		pickFile(container, file);
		unmount();

		const { source, close } = fakeSource(file);
		await settleLoad(source);
		expect(createObjectURL).not.toHaveBeenCalled();
		expect(close).toHaveBeenCalledTimes(1);
	});
});
