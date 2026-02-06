/**
 * Device classification engine for network hosts.
 *
 * Classifies discovered hosts into device categories using weighted signals
 * from mDNS services, SSDP/UPnP device types, WS-Discovery, OUI vendor,
 * and open port patterns.
 */

import type {
	MdnsServiceInfo,
	PortInfo,
	SsdpDeviceInfo,
	UnifiedHost,
	WsDiscoveryInfo,
} from './network-scanner.js';

// =============================================================================
// Device Categories
// =============================================================================

export type DeviceCategory =
	| 'router'
	| 'access_point'
	| 'switch'
	| 'printer'
	| 'nas'
	| 'camera'
	| 'media_player'
	| 'speaker'
	| 'phone'
	| 'tablet'
	| 'desktop'
	| 'laptop'
	| 'server'
	| 'iot'
	| 'unknown';

export interface DeviceClassification {
	/** Device category */
	readonly category: DeviceCategory;
	/** Confidence score (0.0 - 1.0) */
	readonly confidence: number;
	/** Human-readable evidence for the classification */
	readonly evidence: readonly string[];
}

/** Display information for a device category */
export interface DeviceCategoryInfo {
	readonly label: string;
	readonly description: string;
}

export const DEVICE_CATEGORIES: Readonly<Record<DeviceCategory, DeviceCategoryInfo>> = {
	router: { label: 'Router', description: 'Network router or gateway' },
	access_point: { label: 'Access Point', description: 'Wireless access point' },
	switch: { label: 'Switch', description: 'Network switch' },
	printer: { label: 'Printer', description: 'Printer or multifunction device' },
	nas: { label: 'NAS', description: 'Network attached storage' },
	camera: { label: 'Camera', description: 'IP camera or security camera' },
	media_player: { label: 'Media Player', description: 'TV, streaming device, or media player' },
	speaker: { label: 'Speaker', description: 'Smart speaker or audio device' },
	phone: { label: 'Phone', description: 'Smartphone or mobile device' },
	tablet: { label: 'Tablet', description: 'Tablet device' },
	desktop: { label: 'Desktop', description: 'Desktop computer' },
	laptop: { label: 'Laptop', description: 'Laptop computer' },
	server: { label: 'Server', description: 'Server or VM' },
	iot: { label: 'IoT', description: 'IoT or smart home device' },
	unknown: { label: 'Unknown', description: 'Unknown device type' },
};

// =============================================================================
// Signal Types
// =============================================================================

interface Signal {
	readonly category: DeviceCategory;
	readonly weight: number;
	readonly evidence: string;
}

// =============================================================================
// Classification Logic
// =============================================================================

/** mDNS service type → device signal mapping */
const MDNS_PATTERNS: readonly {
	readonly patterns: readonly string[];
	readonly category: DeviceCategory;
	readonly weight: number;
}[] = [
	{ patterns: ['_ipp.', '_printer.', '_pdl-datastream.'], category: 'printer', weight: 0.8 },
	{ patterns: ['_airplay.'], category: 'media_player', weight: 0.4 },
	{ patterns: ['_raop.'], category: 'speaker', weight: 0.4 },
	{ patterns: ['_googlecast.'], category: 'media_player', weight: 0.8 },
	{ patterns: ['_spotify-connect.'], category: 'speaker', weight: 0.6 },
	{ patterns: ['_homekit.', '_hap.'], category: 'iot', weight: 0.6 },
	{ patterns: ['_smb.', '_afpovertcp.', '_nfs.'], category: 'nas', weight: 0.4 },
	{ patterns: ['_ssh.', '_sftp-ssh.'], category: 'server', weight: 0.3 },
	{ patterns: ['_mqtt.'], category: 'iot', weight: 0.5 },
	{ patterns: ['_rtsp.'], category: 'camera', weight: 0.7 },
];

/** Collect signals from mDNS services */
const collectMdnsSignals = (services: readonly MdnsServiceInfo[]): Signal[] =>
	services.flatMap((service) => {
		const type = service.serviceType.toLowerCase();
		return MDNS_PATTERNS.filter((rule) => rule.patterns.some((p) => type.includes(p))).map(
			(rule) => ({
				category: rule.category,
				weight: rule.weight,
				evidence: `mDNS: ${service.serviceType}`,
			})
		);
	});

/** SSDP device type → device signal mapping */
const SSDP_DEVICE_TYPE_PATTERNS: readonly {
	readonly patterns: readonly string[];
	readonly category: DeviceCategory;
	readonly weight: number;
}[] = [
	{ patterns: ['internetgatewaydevice', 'wandevice'], category: 'router', weight: 0.9 },
	{ patterns: ['wlandevice', 'wlanap'], category: 'access_point', weight: 0.8 },
	{ patterns: ['mediarenderer'], category: 'media_player', weight: 0.8 },
	{ patterns: ['mediaserver'], category: 'nas', weight: 0.5 },
	{ patterns: ['printer'], category: 'printer', weight: 0.9 },
];

/** SSDP manufacturer → device signal mapping */
const SSDP_MANUFACTURER_PATTERNS: readonly {
	readonly patterns: readonly string[];
	readonly category: DeviceCategory;
	readonly weight: number;
}[] = [
	{ patterns: ['synology', 'qnap', 'asustor'], category: 'nas', weight: 0.8 },
	{ patterns: ['hikvision', 'dahua', 'axis'], category: 'camera', weight: 0.8 },
	{ patterns: ['sonos', 'bose', 'harman'], category: 'speaker', weight: 0.7 },
];

/** Match patterns against a value and return signals */
const matchPatterns = (
	value: string,
	patterns: readonly {
		readonly patterns: readonly string[];
		readonly category: DeviceCategory;
		readonly weight: number;
	}[],
	evidencePrefix: string,
	evidenceValue: string | undefined
): Signal[] =>
	patterns
		.filter((rule) => rule.patterns.some((p) => value.includes(p)))
		.map((rule) => ({
			category: rule.category,
			weight: rule.weight,
			evidence: `${evidencePrefix}: ${evidenceValue}`,
		}));

/** Collect signals from SSDP/UPnP device info */
const collectSsdpSignals = (device: SsdpDeviceInfo): Signal[] => {
	const deviceType = (device.deviceType ?? '').toLowerCase();
	const friendlyName = (device.friendlyName ?? '').toLowerCase();
	const manufacturer = (device.manufacturer ?? '').toLowerCase();
	const modelName = (device.modelName ?? '').toLowerCase();

	const typeSignals = matchPatterns(
		deviceType,
		SSDP_DEVICE_TYPE_PATTERNS,
		'SSDP deviceType',
		device.deviceType
	);
	const mfrSignals = matchPatterns(
		manufacturer,
		SSDP_MANUFACTURER_PATTERNS,
		'SSDP manufacturer',
		device.manufacturer
	);

	// Special case: basic device type with known audio manufacturers
	const basicSpeakerSignals: Signal[] =
		deviceType.includes('basic') &&
		(manufacturer.includes('sonos') || manufacturer.includes('bose'))
			? [
					{
						category: 'speaker',
						weight: 0.8,
						evidence: `SSDP manufacturer: ${device.manufacturer}`,
					},
				]
			: [];

	// Special case: TV detection for Samsung/LG/Sony
	const tvManufacturers = ['samsung', 'lg', 'sony'];
	const tvSignals: Signal[] =
		tvManufacturers.some((m) => manufacturer.includes(m)) &&
		(friendlyName.includes('tv') || modelName.includes('tv'))
			? [{ category: 'media_player', weight: 0.8, evidence: 'SSDP: TV detected' }]
			: [];

	return [...typeSignals, ...basicSpeakerSignals, ...mfrSignals, ...tvSignals];
};

/** Collect signals from WS-Discovery info */
const collectWsDiscoverySignals = (wsInfo: WsDiscoveryInfo): Signal[] =>
	wsInfo.deviceTypes.flatMap((type) => {
		const lower = type.toLowerCase();
		const signals: Signal[] = [];

		if (lower.includes('printer') || lower.includes('print')) {
			signals.push({ category: 'printer', weight: 0.8, evidence: `WS-Discovery: ${type}` });
		}
		if (lower.includes('scanner')) {
			signals.push({ category: 'printer', weight: 0.6, evidence: `WS-Discovery: ${type}` });
		}
		if (lower.includes('camera')) {
			signals.push({ category: 'camera', weight: 0.8, evidence: `WS-Discovery: ${type}` });
		}
		if (lower.includes('computer') || lower.includes('device')) {
			signals.push({ category: 'desktop', weight: 0.3, evidence: `WS-Discovery: ${type}` });
		}

		return signals;
	});

/** Collect signals from OUI vendor name */
const collectVendorSignals = (vendor: string): Signal[] => {
	const lower = vendor.toLowerCase();
	const signals: Signal[] = [];

	// Apple devices
	if (lower.includes('apple')) {
		signals.push({ category: 'desktop', weight: 0.3, evidence: `Vendor: ${vendor}` });
	}

	// Raspberry Pi
	if (lower.includes('raspberry')) {
		signals.push({ category: 'iot', weight: 0.5, evidence: `Vendor: ${vendor}` });
	}

	// Router/Network equipment manufacturers
	if (
		lower.includes('cisco') ||
		lower.includes('juniper') ||
		lower.includes('arista') ||
		lower.includes('mikrotik')
	) {
		signals.push({ category: 'router', weight: 0.5, evidence: `Vendor: ${vendor}` });
	}
	if (lower.includes('ubiquiti') || lower.includes('ruckus') || lower.includes('aruba')) {
		signals.push({ category: 'access_point', weight: 0.5, evidence: `Vendor: ${vendor}` });
	}

	// Printer manufacturers
	if (
		lower.includes('hewlett') ||
		lower.includes('canon') ||
		lower.includes('epson') ||
		lower.includes('brother') ||
		lower.includes('xerox') ||
		lower.includes('ricoh')
	) {
		signals.push({ category: 'printer', weight: 0.4, evidence: `Vendor: ${vendor}` });
	}

	// NAS manufacturers
	if (lower.includes('synology') || lower.includes('qnap') || lower.includes('buffalo')) {
		signals.push({ category: 'nas', weight: 0.6, evidence: `Vendor: ${vendor}` });
	}

	// Camera manufacturers
	if (lower.includes('hikvision') || lower.includes('dahua') || lower.includes('axis')) {
		signals.push({ category: 'camera', weight: 0.6, evidence: `Vendor: ${vendor}` });
	}

	// Speaker manufacturers
	if (lower.includes('sonos') || lower.includes('bose')) {
		signals.push({ category: 'speaker', weight: 0.6, evidence: `Vendor: ${vendor}` });
	}

	// Samsung / LG can be many things
	if (lower.includes('samsung') || lower.includes('lg electronics')) {
		signals.push({ category: 'media_player', weight: 0.2, evidence: `Vendor: ${vendor}` });
	}

	return signals;
};

/** Hostname patterns → device signal mapping */
const HOSTNAME_PATTERNS: readonly {
	readonly patterns: readonly string[];
	readonly category: DeviceCategory;
	readonly weight: number;
}[] = [
	{ patterns: ['macbook'], category: 'laptop', weight: 0.7 },
	{ patterns: ['imac'], category: 'desktop', weight: 0.7 },
	{ patterns: ['mac-mini', 'macmini'], category: 'desktop', weight: 0.7 },
	{ patterns: ['mac-pro', 'macpro', 'mac-studio'], category: 'desktop', weight: 0.7 },
	{ patterns: ['ipad'], category: 'tablet', weight: 0.7 },
	{ patterns: ['iphone'], category: 'phone', weight: 0.7 },
	{ patterns: ['asustor'], category: 'nas', weight: 0.7 },
	{ patterns: ['synology', 'diskstation'], category: 'nas', weight: 0.7 },
	{ patterns: ['qnap'], category: 'nas', weight: 0.7 },
	{ patterns: ['raspberrypi', 'raspberry-pi'], category: 'iot', weight: 0.6 },
];

/** Collect signals from hostname and NetBIOS name patterns */
const collectHostnameSignals = (hostname: string | null, netbiosName: string | null): Signal[] => {
	const names = [hostname, netbiosName].filter(Boolean) as string[];
	return names.flatMap((name) => {
		const lower = name.toLowerCase();
		return HOSTNAME_PATTERNS.filter((rule) => rule.patterns.some((p) => lower.includes(p))).map(
			(rule) => ({
				category: rule.category,
				weight: rule.weight,
				evidence: `Hostname: ${name}`,
			})
		);
	});
};

/** Collect signals from open port patterns */
const collectPortSignals = (ports: readonly PortInfo[]): Signal[] => {
	const openPorts = new Set(ports.filter((p) => p.state === 'open').map((p) => p.port));
	const signals: Signal[] = [];

	// Printer ports
	if (openPorts.has(631) || openPorts.has(9100) || openPorts.has(515)) {
		signals.push({
			category: 'printer',
			weight: 0.4,
			evidence: 'Ports: printer services (631/9100/515)',
		});
	}

	// Web server ports (could be anything, low confidence)
	if ((openPorts.has(80) || openPorts.has(443)) && openPorts.size <= 3) {
		signals.push({ category: 'iot', weight: 0.2, evidence: 'Ports: web-only device' });
	}

	// Server patterns
	if (openPorts.has(22) && (openPorts.has(80) || openPorts.has(443)) && openPorts.size >= 3) {
		signals.push({
			category: 'server',
			weight: 0.3,
			evidence: 'Ports: SSH + HTTP (server pattern)',
		});
	}

	// NAS patterns
	if (openPorts.has(445) && (openPorts.has(5000) || openPorts.has(5001))) {
		signals.push({ category: 'nas', weight: 0.5, evidence: 'Ports: SMB + NAS web UI (5000/5001)' });
	}
	if (openPorts.has(548) && openPorts.has(445)) {
		signals.push({ category: 'nas', weight: 0.4, evidence: 'Ports: AFP + SMB' });
	}

	// Camera pattern
	if (openPorts.has(554)) {
		signals.push({ category: 'camera', weight: 0.5, evidence: 'Ports: RTSP (554)' });
	}

	// RDP suggests desktop/laptop
	if (openPorts.has(3389)) {
		signals.push({ category: 'desktop', weight: 0.3, evidence: 'Ports: RDP (3389)' });
	}

	// VNC suggests desktop/laptop
	if (openPorts.has(5900)) {
		signals.push({ category: 'desktop', weight: 0.3, evidence: 'Ports: VNC (5900)' });
	}

	// Database ports suggest server
	if (openPorts.has(3306) || openPorts.has(5432) || openPorts.has(27017) || openPorts.has(6379)) {
		signals.push({ category: 'server', weight: 0.4, evidence: 'Ports: database services' });
	}

	return signals;
};

// =============================================================================
// Main Classification Function
// =============================================================================

/**
 * Classify a unified host into a device category.
 *
 * Uses weighted signals from multiple sources to determine the most likely
 * device category with a confidence score.
 */
export const classifyDevice = (host: UnifiedHost): DeviceClassification => {
	const signals: Signal[] = [];

	// Collect signals from all sources
	if (host.hostname || host.netbiosName) {
		signals.push(...collectHostnameSignals(host.hostname, host.netbiosName));
	}

	if (host.mdnsServices.length > 0) {
		signals.push(...collectMdnsSignals(host.mdnsServices));
	}

	if (host.ssdpDevice) {
		signals.push(...collectSsdpSignals(host.ssdpDevice));
	}

	if (host.wsDiscovery) {
		signals.push(...collectWsDiscoverySignals(host.wsDiscovery));
	}

	if (host.vendor) {
		signals.push(...collectVendorSignals(host.vendor));
	}

	if (host.ports.length > 0) {
		signals.push(...collectPortSignals(host.ports));
	}

	// No signals → unknown
	if (signals.length === 0) {
		return { category: 'unknown', confidence: 0, evidence: [] };
	}

	// Aggregate scores per category
	const scores = new Map<DeviceCategory, { totalWeight: number; evidence: string[] }>();

	for (const signal of signals) {
		const existing = scores.get(signal.category);
		if (existing) {
			existing.totalWeight += signal.weight;
			existing.evidence.push(signal.evidence);
		} else {
			scores.set(signal.category, { totalWeight: signal.weight, evidence: [signal.evidence] });
		}
	}

	// Find the category with the highest total weight
	let bestCategory: DeviceCategory = 'unknown';
	let bestScore = 0;
	let bestEvidence: string[] = [];

	for (const [category, { totalWeight, evidence }] of scores) {
		if (totalWeight > bestScore) {
			bestScore = totalWeight;
			bestCategory = category;
			bestEvidence = evidence;
		}
	}

	// Normalize confidence to 0-1 range (cap at 1.0)
	const confidence = Math.min(bestScore, 1.0);

	return {
		category: bestCategory,
		confidence,
		evidence: bestEvidence,
	};
};

/**
 * Classify all hosts in a list and return a map of host ID to classification.
 */
export const classifyHosts = (
	hosts: readonly UnifiedHost[]
): ReadonlyMap<string, DeviceClassification> => {
	const map = new Map<string, DeviceClassification>();
	for (const host of hosts) {
		map.set(host.id, classifyDevice(host));
	}
	return map;
};
