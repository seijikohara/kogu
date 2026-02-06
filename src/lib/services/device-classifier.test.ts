import { describe, expect, it } from 'vitest';
import {
	classifyDevice,
	classifyHosts,
	DEVICE_CATEGORIES,
	type DeviceCategory,
} from './device-classifier.js';
import type { UnifiedHost } from './network-scanner.js';

/** Create a minimal UnifiedHost for testing */
const createHost = (overrides: Partial<UnifiedHost> = {}): UnifiedHost => ({
	id: 'ip:192.168.1.1',
	ips: ['192.168.1.1'],
	hostname: null,
	hostnameSource: null,
	netbiosName: null,
	macAddress: null,
	vendor: null,
	mdnsServices: [],
	ssdpDevice: null,
	wsDiscovery: null,
	snmpInfo: null,
	tlsNames: [],
	discoveryMethods: [],
	discoveries: [],
	ports: [],
	scanDurationMs: null,
	...overrides,
});

describe('device-classifier', () => {
	describe('classifyDevice', () => {
		it('returns unknown for host with no signals', () => {
			const host = createHost();
			const result = classifyDevice(host);
			expect(result.category).toBe('unknown');
			expect(result.confidence).toBe(0);
			expect(result.evidence).toHaveLength(0);
		});

		describe('mDNS signals', () => {
			it('classifies printer from IPP service', () => {
				const host = createHost({
					mdnsServices: [
						{
							instanceName: 'My Printer',
							serviceType: '_ipp._tcp.local.',
							port: 631,
							properties: [],
						},
					],
				});
				const result = classifyDevice(host);
				expect(result.category).toBe('printer');
				expect(result.confidence).toBeGreaterThan(0.5);
			});

			it('classifies media player from AirPlay service', () => {
				const host = createHost({
					mdnsServices: [
						{
							instanceName: 'Apple TV',
							serviceType: '_airplay._tcp.local.',
							port: 7000,
							properties: [],
						},
					],
				});
				const result = classifyDevice(host);
				expect(result.category).toBe('media_player');
			});

			it('classifies media player from Google Cast', () => {
				const host = createHost({
					mdnsServices: [
						{
							instanceName: 'Chromecast',
							serviceType: '_googlecast._tcp.local.',
							port: 8009,
							properties: [],
						},
					],
				});
				const result = classifyDevice(host);
				expect(result.category).toBe('media_player');
			});

			it('classifies speaker from RAOP service', () => {
				const host = createHost({
					mdnsServices: [
						{
							instanceName: 'HomePod',
							serviceType: '_raop._tcp.local.',
							port: 7000,
							properties: [],
						},
					],
				});
				const result = classifyDevice(host);
				expect(result.category).toBe('speaker');
			});

			it('classifies camera from RTSP service', () => {
				const host = createHost({
					mdnsServices: [
						{
							instanceName: 'IP Camera',
							serviceType: '_rtsp._tcp.local.',
							port: 554,
							properties: [],
						},
					],
				});
				const result = classifyDevice(host);
				expect(result.category).toBe('camera');
			});

			it('classifies IoT from HomeKit service', () => {
				const host = createHost({
					mdnsServices: [
						{
							instanceName: 'Smart Light',
							serviceType: '_homekit._tcp.local.',
							port: 8080,
							properties: [],
						},
					],
				});
				const result = classifyDevice(host);
				expect(result.category).toBe('iot');
			});
		});

		describe('SSDP signals', () => {
			it('classifies router from InternetGatewayDevice', () => {
				const host = createHost({
					ssdpDevice: {
						deviceType: 'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
						friendlyName: 'My Router',
					},
				});
				const result = classifyDevice(host);
				expect(result.category).toBe('router');
				expect(result.confidence).toBeGreaterThanOrEqual(0.9);
			});

			it('classifies media player from MediaRenderer', () => {
				const host = createHost({
					ssdpDevice: {
						deviceType: 'urn:schemas-upnp-org:device:MediaRenderer:1',
					},
				});
				const result = classifyDevice(host);
				expect(result.category).toBe('media_player');
			});

			it('classifies NAS from Synology manufacturer', () => {
				const host = createHost({
					ssdpDevice: {
						manufacturer: 'Synology Inc.',
						modelName: 'DS920+',
					},
				});
				const result = classifyDevice(host);
				expect(result.category).toBe('nas');
			});

			it('classifies printer from SSDP printer deviceType', () => {
				const host = createHost({
					ssdpDevice: {
						deviceType: 'urn:schemas-upnp-org:device:Printer:1',
					},
				});
				const result = classifyDevice(host);
				expect(result.category).toBe('printer');
			});
		});

		describe('WS-Discovery signals', () => {
			it('classifies printer from WS-Discovery print type', () => {
				const host = createHost({
					wsDiscovery: {
						deviceTypes: ['wsdp:Device', 'print:PrintDeviceType'],
						xaddrs: [],
						scopes: [],
					},
				});
				const result = classifyDevice(host);
				expect(result.category).toBe('printer');
			});

			it('classifies camera from WS-Discovery camera type', () => {
				const host = createHost({
					wsDiscovery: {
						deviceTypes: ['dn:NetworkVideoTransmitter', 'tds:camera'],
						xaddrs: [],
						scopes: [],
					},
				});
				const result = classifyDevice(host);
				expect(result.category).toBe('camera');
			});
		});

		describe('vendor signals', () => {
			it('provides signal for Raspberry Pi', () => {
				const host = createHost({ vendor: 'Raspberry Pi Foundation' });
				const result = classifyDevice(host);
				expect(result.category).toBe('iot');
			});

			it('provides signal for Synology vendor', () => {
				const host = createHost({ vendor: 'Synology Incorporated' });
				const result = classifyDevice(host);
				expect(result.category).toBe('nas');
			});

			it('provides signal for network equipment vendor', () => {
				const host = createHost({ vendor: 'Cisco Systems' });
				const result = classifyDevice(host);
				expect(result.category).toBe('router');
			});
		});

		describe('port signals', () => {
			it('classifies printer from printer ports', () => {
				const host = createHost({
					ports: [
						{ port: 631, state: 'open', service: 'IPP' },
						{ port: 9100, state: 'open', service: 'JetDirect' },
					],
				});
				const result = classifyDevice(host);
				expect(result.category).toBe('printer');
			});

			it('classifies camera from RTSP port', () => {
				const host = createHost({
					ports: [{ port: 554, state: 'open', service: 'RTSP' }],
				});
				const result = classifyDevice(host);
				expect(result.category).toBe('camera');
			});

			it('classifies server from database ports', () => {
				const host = createHost({
					ports: [
						{ port: 22, state: 'open', service: 'SSH' },
						{ port: 3306, state: 'open', service: 'MySQL' },
						{ port: 80, state: 'open', service: 'HTTP' },
					],
				});
				const result = classifyDevice(host);
				// Could be server due to SSH+HTTP+DB
				expect(['server', 'iot']).toContain(result.category);
			});
		});

		describe('combined signals', () => {
			it('combines mDNS + vendor for higher confidence', () => {
				const host = createHost({
					vendor: 'Synology Incorporated',
					mdnsServices: [
						{ instanceName: 'NAS', serviceType: '_smb._tcp.local.', port: 445, properties: [] },
						{
							instanceName: 'NAS',
							serviceType: '_afpovertcp._tcp.local.',
							port: 548,
							properties: [],
						},
					],
				});
				const result = classifyDevice(host);
				expect(result.category).toBe('nas');
				expect(result.confidence).toBeGreaterThan(0.5);
				expect(result.evidence.length).toBeGreaterThan(1);
			});

			it('SSDP router overrides low-confidence port signals', () => {
				const host = createHost({
					ssdpDevice: {
						deviceType: 'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
					},
					ports: [
						{ port: 80, state: 'open', service: 'HTTP' },
						{ port: 443, state: 'open', service: 'HTTPS' },
					],
				});
				const result = classifyDevice(host);
				expect(result.category).toBe('router');
			});
		});
	});

	describe('classifyHosts', () => {
		it('returns a map with classifications for all hosts', () => {
			const hosts = [
				createHost({ id: 'ip:192.168.1.1' }),
				createHost({
					id: 'ip:192.168.1.2',
					ssdpDevice: {
						deviceType: 'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
					},
				}),
			];
			const map = classifyHosts(hosts);
			expect(map.size).toBe(2);
			expect(map.get('ip:192.168.1.1')?.category).toBe('unknown');
			expect(map.get('ip:192.168.1.2')?.category).toBe('router');
		});
	});

	describe('DEVICE_CATEGORIES', () => {
		it('has entries for all device categories', () => {
			const categories: DeviceCategory[] = [
				'router',
				'access_point',
				'switch',
				'printer',
				'nas',
				'camera',
				'media_player',
				'speaker',
				'phone',
				'tablet',
				'desktop',
				'laptop',
				'server',
				'iot',
				'unknown',
			];
			for (const cat of categories) {
				expect(DEVICE_CATEGORIES[cat]).toBeDefined();
				expect(DEVICE_CATEGORIES[cat].label).toBeTruthy();
				expect(DEVICE_CATEGORIES[cat].description).toBeTruthy();
			}
		});
	});
});
