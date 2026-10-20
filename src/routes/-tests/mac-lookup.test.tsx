import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	type getOuiDatabaseInfo,
	lookupVendor,
	SAMPLE_MAC,
	type VendorResult,
} from '@/lib/services/mac';

import { Route } from '../mac-lookup';
import { renderRoute } from './render-route';

vi.mock('@/lib/components/editor', () => import('./code-editor-stub'));

vi.mock('@/lib/services/mac', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	lookupVendor: vi.fn<typeof lookupVendor>(),
	getOuiDatabaseInfo: vi.fn<typeof getOuiDatabaseInfo>(() => Promise.resolve(null)),
}));

interface PendingLookup {
	readonly mac: string;
	readonly resolve: (result: VendorResult) => void;
}

const pending: PendingLookup[] = [];

const resolveLookup = async (index: number, vendor: string) => {
	const lookup = pending[index];
	if (!lookup) throw new Error(`No pending lookup at index ${index}`);
	await act(async () => {
		lookup.resolve({ vendor, matchedPrefix: lookup.mac.slice(0, 8) });
		await Promise.resolve();
	});
};

const renderPage = () => renderRoute(Route);

describe('MAC lookup page', () => {
	beforeEach(() => {
		pending.length = 0;
		vi.mocked(lookupVendor).mockImplementation(
			(mac) =>
				new Promise<VendorResult>((resolve) => {
					pending.push({ mac: mac.canonical, resolve });
				})
		);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('hides the previous vendor while the lookup for a new MAC is pending', async () => {
		await renderPage();
		expect(pending).toHaveLength(1);
		await resolveLookup(0, 'Vendor A');
		expect(screen.getAllByText('Vendor A').length).toBeGreaterThan(0);

		const input = screen.getByDisplayValue(SAMPLE_MAC);
		fireEvent.change(input, { target: { value: '' } });
		fireEvent.change(input, { target: { value: '3C:22:FB:00:00:01' } });

		expect(pending).toHaveLength(2);
		expect(screen.queryByText('Vendor A')).toBeNull();

		await resolveLookup(1, 'Vendor B');
		expect(screen.getAllByText('Vendor B').length).toBeGreaterThan(0);
		expect(screen.queryByText('Vendor A')).toBeNull();
	});

	it('ignores a lookup that settles after the input changed again', async () => {
		await renderPage();
		const input = screen.getByDisplayValue(SAMPLE_MAC);
		fireEvent.change(input, { target: { value: '3C:22:FB:00:00:01' } });
		expect(pending).toHaveLength(2);

		await resolveLookup(0, 'Vendor A');
		expect(screen.queryByText('Vendor A')).toBeNull();

		await resolveLookup(1, 'Vendor B');
		expect(screen.getAllByText('Vendor B').length).toBeGreaterThan(0);
	});
});
