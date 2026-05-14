import { describe, expect, it } from 'vitest';
import {
	type DiscoveryResult,
	type HostMetadata,
	type HostResult,
	type PortInfo,
	mergeHosts,
} from './network-scanner.js';

/**
 * Build a HostMetadata fixture. Required `readonly` fields with sensible
 * defaults so tests only specify what they care about.
 */
const buildMetadata = (overrides: Partial<HostMetadata> = {}): HostMetadata => ({
	mdnsServices: [],
	tlsNames: [],
	...overrides,
});

/** Build a DiscoveryResult fixture for a single method. */
const buildDiscoveryResult = (
	overrides: Partial<DiscoveryResult> & { method: string }
): DiscoveryResult => ({
	hosts: [],
	hostnames: {},
	hostMetadata: {},
	unreachable: [],
	durationMs: 0,
	error: null,
	requiresPrivileges: false,
	...overrides,
});

const buildHostResult = (overrides: Partial<HostResult> & { ip: string }): HostResult => ({
	ports: [],
	scanDurationMs: 0,
	...overrides,
});

const openPort = (port: number): PortInfo => ({ port, state: 'open' });

describe('mergeHosts', () => {
	it('returns an empty array when both inputs are empty', () => {
		const result = mergeHosts([], []);
		expect(result).toEqual([]);
	});

	it('emits one UnifiedHost for a single bare discovery result', () => {
		const discovery = buildDiscoveryResult({
			method: 'arp_cache',
			hosts: ['192.168.1.10'],
		});

		const result = mergeHosts([discovery], []);

		expect(result).toHaveLength(1);
		expect(result[0]?.ips).toEqual(['192.168.1.10']);
		expect(result[0]?.discoveryMethods).toEqual(['arp_cache']);
	});

	it('unions discovery methods when two reports share the same IP', () => {
		const arp = buildDiscoveryResult({
			method: 'arp_cache',
			hosts: ['192.168.1.20'],
			hostMetadata: {
				'192.168.1.20': buildMetadata({ macAddress: 'aa:bb:cc:dd:ee:ff' }),
			},
		});
		const mdns = buildDiscoveryResult({
			method: 'mdns',
			hosts: ['192.168.1.20'],
			hostnames: { '192.168.1.20': 'printer.local' },
			hostMetadata: {
				'192.168.1.20': buildMetadata({ hostname: 'printer.local', hostnameSource: 'mdns' }),
			},
		});

		const result = mergeHosts([arp, mdns], []);

		expect(result).toHaveLength(1);
		expect(result[0]?.ips).toEqual(['192.168.1.20']);
		expect(result[0]?.discoveryMethods.sort()).toEqual(['arp_cache', 'mdns']);
		expect(result[0]?.macAddress).toBe('aa:bb:cc:dd:ee:ff');
		expect(result[0]?.hostname).toBe('printer.local');
		expect(result[0]?.hostnameSource).toBe('mdns');
	});

	it('merges two IPs reported by different methods when they share a MAC', () => {
		const arp = buildDiscoveryResult({
			method: 'arp_cache',
			hosts: ['192.168.1.30'],
			hostMetadata: {
				'192.168.1.30': buildMetadata({ macAddress: 'aa:bb:cc:11:22:33' }),
			},
		});
		const ndp = buildDiscoveryResult({
			method: 'arp_cache',
			hosts: ['fe80::abcd'],
			hostMetadata: {
				'fe80::abcd': buildMetadata({ macAddress: 'AA-BB-CC-11-22-33' }),
			},
		});

		const result = mergeHosts([arp, ndp], []);

		expect(result).toHaveLength(1);
		expect(result[0]?.ips.sort()).toEqual(['192.168.1.30', 'fe80::abcd']);
		expect(result[0]?.macAddress).toBe('aa:bb:cc:11:22:33');
	});

	it('merges v4 ArpCache + v6 mDNS via shared hostname when MAC differs', () => {
		const arp = buildDiscoveryResult({
			method: 'arp_cache',
			hosts: ['192.168.1.40'],
			hostMetadata: {
				'192.168.1.40': buildMetadata({ macAddress: 'aa:bb:cc:dd:ee:01' }),
			},
		});
		const mdns = buildDiscoveryResult({
			method: 'mdns',
			hosts: ['fe80::beef'],
			hostnames: { 'fe80::beef': 'apple-tv.local' },
			hostMetadata: {
				'fe80::beef': buildMetadata({ hostname: 'apple-tv.local', hostnameSource: 'mdns' }),
			},
		});
		// Give the v4 host the same hostname (e.g., from DNS PTR) so they merge.
		const dns = buildDiscoveryResult({
			method: 'dns',
			hosts: ['192.168.1.40'],
			hostnames: { '192.168.1.40': 'apple-tv' },
			hostMetadata: {
				'192.168.1.40': buildMetadata({ hostname: 'apple-tv', hostnameSource: 'dns' }),
			},
		});

		const result = mergeHosts([arp, mdns, dns], []);

		expect(result).toHaveLength(1);
		expect(result[0]?.ips.sort()).toEqual(['192.168.1.40', 'fe80::beef']);
		// mDNS wins over DNS for the displayed hostname.
		expect(result[0]?.hostname).toBe('apple-tv.local');
		expect(result[0]?.hostnameSource).toBe('mdns');
	});

	it('merges router.local (mdns) with router (netbios) via suffix stripping', () => {
		const mdns = buildDiscoveryResult({
			method: 'mdns',
			hosts: ['192.168.1.1'],
			hostnames: { '192.168.1.1': 'router.local' },
			hostMetadata: {
				'192.168.1.1': buildMetadata({ hostname: 'router.local', hostnameSource: 'mdns' }),
			},
		});
		const netbios = buildDiscoveryResult({
			method: 'tcp_connect',
			hosts: ['192.168.1.2'],
			hostMetadata: {
				'192.168.1.2': buildMetadata({ netbiosName: 'router' }),
			},
		});

		const result = mergeHosts([mdns, netbios], []);

		expect(result).toHaveLength(1);
		expect(result[0]?.ips.sort()).toEqual(['192.168.1.1', '192.168.1.2']);
		expect(result[0]?.hostname).toBe('router.local');
	});

	it('merges Router.LOCAL. (FQDN, uppercase) with router via normalization', () => {
		const mdns = buildDiscoveryResult({
			method: 'mdns',
			hosts: ['192.168.1.50'],
			hostnames: { '192.168.1.50': 'Router.LOCAL.' },
			hostMetadata: {
				'192.168.1.50': buildMetadata({ hostname: 'Router.LOCAL.', hostnameSource: 'mdns' }),
			},
		});
		const netbios = buildDiscoveryResult({
			method: 'tcp_connect',
			hosts: ['192.168.1.51'],
			hostMetadata: {
				'192.168.1.51': buildMetadata({ netbiosName: 'router' }),
			},
		});

		const result = mergeHosts([mdns, netbios], []);

		expect(result).toHaveLength(1);
		expect(result[0]?.ips.sort()).toEqual(['192.168.1.50', '192.168.1.51']);
	});

	it('keeps two hosts separate when MAC and hostname both differ', () => {
		const a = buildDiscoveryResult({
			method: 'arp_cache',
			hosts: ['192.168.1.60'],
			hostnames: { '192.168.1.60': 'alpha.local' },
			hostMetadata: {
				'192.168.1.60': buildMetadata({
					macAddress: 'aa:bb:cc:00:00:01',
					hostname: 'alpha.local',
					hostnameSource: 'mdns',
				}),
			},
		});
		const b = buildDiscoveryResult({
			method: 'arp_cache',
			hosts: ['192.168.1.61'],
			hostnames: { '192.168.1.61': 'bravo.local' },
			hostMetadata: {
				'192.168.1.61': buildMetadata({
					macAddress: 'aa:bb:cc:00:00:02',
					hostname: 'bravo.local',
					hostnameSource: 'mdns',
				}),
			},
		});

		const result = mergeHosts([a, b], []);

		expect(result).toHaveLength(2);
		const ips = result.map((host) => host.ips[0]);
		expect(ips).toEqual(['192.168.1.60', '192.168.1.61']);
	});

	it('merges transitively (A↔MAC↔B↔hostname↔C)', () => {
		// A and B share a MAC; B and C share a hostname; expect all three in one group.
		const a = buildDiscoveryResult({
			method: 'arp_cache',
			hosts: ['192.168.1.70'],
			hostMetadata: {
				'192.168.1.70': buildMetadata({ macAddress: 'aa:bb:cc:00:00:10' }),
			},
		});
		const b = buildDiscoveryResult({
			method: 'arp_cache',
			hosts: ['fe80::1'],
			hostMetadata: {
				'fe80::1': buildMetadata({
					macAddress: 'aa:bb:cc:00:00:10',
					hostname: 'nas.local',
					hostnameSource: 'mdns',
				}),
			},
		});
		const c = buildDiscoveryResult({
			method: 'dns',
			hosts: ['192.168.1.71'],
			hostnames: { '192.168.1.71': 'nas' },
			hostMetadata: {
				'192.168.1.71': buildMetadata({ hostname: 'nas', hostnameSource: 'dns' }),
			},
		});

		const result = mergeHosts([a, b, c], []);

		expect(result).toHaveLength(1);
		expect(result[0]?.ips.sort()).toEqual(['192.168.1.70', '192.168.1.71', 'fe80::1']);
	});

	it('includes scan-only hosts even without discovery results', () => {
		const scan = buildHostResult({
			ip: '192.168.1.80',
			ports: [openPort(22), openPort(443)],
			scanDurationMs: 1500,
		});

		const result = mergeHosts([], [scan]);

		expect(result).toHaveLength(1);
		expect(result[0]?.ips).toEqual(['192.168.1.80']);
		expect(result[0]?.ports.map((p) => p.port)).toEqual([22, 443]);
		expect(result[0]?.scanDurationMs).toBe(1500);
	});

	it('surfaces TCP banner-grab results on UnifiedHost.serviceBanners', () => {
		const discovery = buildDiscoveryResult({
			method: 'tcp_connect',
			hosts: ['192.168.1.90'],
			hostMetadata: {
				'192.168.1.90': buildMetadata({
					banners: [
						{ protocol: 'ssh', version: 'OpenSSH_8.6p1', raw: 'SSH-2.0-OpenSSH_8.6p1' },
						{ protocol: 'http', version: 'nginx/1.25.0', raw: 'nginx/1.25.0' },
					],
				}),
			},
		});

		const result = mergeHosts([discovery], []);

		expect(result).toHaveLength(1);
		expect(result[0]?.serviceBanners).toHaveLength(2);
		expect(result[0]?.serviceBanners.map((b) => b.protocol)).toEqual(['ssh', 'http']);
		expect(result[0]?.serviceBanners[0]?.version).toBe('OpenSSH_8.6p1');
	});

	it('deduplicates identical banners reported by multiple discoveries', () => {
		const a = buildDiscoveryResult({
			method: 'tcp_connect',
			hosts: ['192.168.1.91'],
			hostMetadata: {
				'192.168.1.91': buildMetadata({
					banners: [{ protocol: 'ssh', version: 'OpenSSH_9.0', raw: 'SSH-2.0-OpenSSH_9.0' }],
				}),
			},
		});
		const b = buildDiscoveryResult({
			method: 'tcp_connect',
			hosts: ['192.168.1.91'],
			hostMetadata: {
				'192.168.1.91': buildMetadata({
					banners: [{ protocol: 'ssh', version: 'OpenSSH_9.0', raw: 'SSH-2.0-OpenSSH_9.0' }],
				}),
			},
		});

		const result = mergeHosts([a, b], []);

		expect(result).toHaveLength(1);
		expect(result[0]?.serviceBanners).toHaveLength(1);
	});

	it('merges hosts sharing SSDP UDN across v4 and v6', () => {
		const sharedUdn = 'uuid:abcd1234-5678-90ab-cdef-1234567890ab';
		const ssdpV4 = buildDiscoveryResult({
			method: 'ssdp',
			hosts: ['192.168.1.110'],
			hostMetadata: {
				'192.168.1.110': buildMetadata({
					ssdpDevice: { udn: sharedUdn },
				}),
			},
		});
		const ssdpV6 = buildDiscoveryResult({
			method: 'ssdp',
			hosts: ['fe80::dead'],
			hostMetadata: {
				'fe80::dead': buildMetadata({
					ssdpDevice: { udn: sharedUdn },
				}),
			},
		});

		const result = mergeHosts([ssdpV4, ssdpV6], []);

		expect(result).toHaveLength(1);
		expect(result[0]?.ips.sort()).toEqual(['192.168.1.110', 'fe80::dead']);
		expect(result[0]?.ssdpDevice?.udn).toBe(sharedUdn);
	});

	it('merges hosts sharing WS-D EndpointReference across v4 and v6', () => {
		const sharedEpr = 'urn:uuid:11112222-3333-4444-5555-666677778888';
		const wsdV4 = buildDiscoveryResult({
			method: 'ws_discovery',
			hosts: ['192.168.1.120'],
			hostMetadata: {
				'192.168.1.120': buildMetadata({
					wsDiscovery: {
						deviceTypes: ['wsdp:Device'],
						xaddrs: [],
						scopes: [],
						endpointReference: sharedEpr,
					},
				}),
			},
		});
		const wsdV6 = buildDiscoveryResult({
			method: 'ws_discovery',
			hosts: ['fe80::beef'],
			hostMetadata: {
				'fe80::beef': buildMetadata({
					wsDiscovery: {
						deviceTypes: ['wsdp:Device'],
						xaddrs: [],
						scopes: [],
						endpointReference: sharedEpr,
					},
				}),
			},
		});

		const result = mergeHosts([wsdV4, wsdV6], []);

		expect(result).toHaveLength(1);
		expect(result[0]?.ips.sort()).toEqual(['192.168.1.120', 'fe80::beef']);
		expect(result[0]?.wsDiscovery?.endpointReference).toBe(sharedEpr);
	});

	it('keeps hosts with different UDNs separate', () => {
		const a = buildDiscoveryResult({
			method: 'ssdp',
			hosts: ['192.168.1.130'],
			hostMetadata: {
				'192.168.1.130': buildMetadata({
					ssdpDevice: { udn: 'uuid:11111111-1111-1111-1111-111111111111' },
				}),
			},
		});
		const b = buildDiscoveryResult({
			method: 'ssdp',
			hosts: ['192.168.1.131'],
			hostMetadata: {
				'192.168.1.131': buildMetadata({
					ssdpDevice: { udn: 'uuid:22222222-2222-2222-2222-222222222222' },
				}),
			},
		});

		const result = mergeHosts([a, b], []);

		expect(result).toHaveLength(2);
		const ips = result.map((host) => host.ips[0]);
		expect(ips).toEqual(['192.168.1.130', '192.168.1.131']);
	});

	it('merges v4 mDNS with v6 SNMP via shared sysName signal', () => {
		const mdns = buildDiscoveryResult({
			method: 'mdns',
			hosts: ['192.168.1.100'],
			hostnames: { '192.168.1.100': 'switch.local' },
			hostMetadata: {
				'192.168.1.100': buildMetadata({
					hostname: 'switch.local',
					hostnameSource: 'mdns',
				}),
			},
		});
		const snmp = buildDiscoveryResult({
			method: 'snmp',
			hosts: ['fe80::cafe'],
			hostMetadata: {
				'fe80::cafe': buildMetadata({
					hostname: 'switch',
					hostnameSource: 'snmp',
					snmpInfo: { sysName: 'switch', sysDescr: 'Cisco' },
				}),
			},
		});

		const result = mergeHosts([mdns, snmp], []);

		expect(result).toHaveLength(1);
		expect(result[0]?.ips.sort()).toEqual(['192.168.1.100', 'fe80::cafe']);
		// mDNS retains priority over SNMP for the displayed hostname.
		expect(result[0]?.hostname).toBe('switch.local');
		expect(result[0]?.snmpInfo?.sysName).toBe('switch');
	});
});
