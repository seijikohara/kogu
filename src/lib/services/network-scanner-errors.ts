/**
 * Network Scanner error handling utilities.
 * Provides actionable guidance for privilege-related errors.
 */

export type Platform = 'macos' | 'linux' | 'windows' | 'unknown';

export interface ErrorGuidance {
	readonly title: string;
	readonly description: string;
	readonly action?: {
		readonly label: string;
		readonly type: 'setup' | 'check' | 'link';
		readonly url?: string;
	};
	readonly documentation?: string;
}

/**
 * Detect the current platform.
 */
export const detectPlatform = (): Platform => {
	const userAgent = navigator.userAgent.toLowerCase();
	if (userAgent.includes('mac')) return 'macos';
	if (userAgent.includes('linux')) return 'linux';
	if (userAgent.includes('win')) return 'windows';
	return 'unknown';
};

/**
 * Error patterns for privilege-related issues.
 */
const ERROR_PATTERNS = {
	daemonNotRegistered: /daemon.*not.*registered|smappservice.*not.*found/i,
	daemonRequiresApproval: /requires.*approval|login.*items/i,
	binaryNotFound: /net-scanner.*not.*found|binary.*missing|sidecar.*not.*found/i,
	setcapFailed: /setcap.*failed|capability.*denied|pkexec.*failed/i,
	permissionDenied: /permission.*denied|operation.*not.*permitted|access.*denied/i,
	cancelled: /cancelled|canceled|user.*cancel/i,
	timeout: /timeout|timed.*out/i,
} as const;

/**
 * Get actionable guidance for a privilege-related error.
 */
export const getPrivilegeErrorGuidance = (message: string, platform?: Platform): ErrorGuidance => {
	const currentPlatform = platform ?? detectPlatform();
	const lowerMessage = message.toLowerCase();

	// User cancelled - no guidance needed
	if (ERROR_PATTERNS.cancelled.test(lowerMessage)) {
		return {
			title: 'Setup Cancelled',
			description: 'You can try again by clicking Setup Privileges.',
		};
	}

	// Daemon not registered (macOS)
	if (ERROR_PATTERNS.daemonNotRegistered.test(lowerMessage)) {
		return {
			title: 'Daemon Not Registered',
			description: 'The network scanner daemon needs to be registered with the system.',
			action: { label: 'Setup Privileges', type: 'setup' },
			documentation:
				'https://github.com/seijikohara/kogu/blob/main/docs/network-scanner/macos-setup.md',
		};
	}

	// Daemon requires approval (macOS)
	if (ERROR_PATTERNS.daemonRequiresApproval.test(lowerMessage)) {
		return {
			title: 'Approval Required',
			description: 'Enable Kogu in System Settings → General → Login Items & Extensions.',
			action: {
				label: 'Open Documentation',
				type: 'link',
				url: 'https://github.com/seijikohara/kogu/blob/main/docs/network-scanner/macos-setup.md',
			},
			documentation:
				'https://github.com/seijikohara/kogu/blob/main/docs/network-scanner/macos-setup.md',
		};
	}

	// Binary not found
	if (ERROR_PATTERNS.binaryNotFound.test(lowerMessage)) {
		return {
			title: 'Scanner Binary Not Found',
			description: 'The net-scanner binary is missing. Try reinstalling Kogu.',
			documentation:
				'https://github.com/seijikohara/kogu/blob/main/docs/network-scanner/troubleshooting.md',
		};
	}

	// setcap failed (Linux)
	if (ERROR_PATTERNS.setcapFailed.test(lowerMessage)) {
		const manualCommand = 'sudo setcap cap_net_raw,cap_net_admin+ep /path/to/net-scanner';
		return {
			title: 'Capability Setup Failed',
			description:
				currentPlatform === 'linux'
					? `Try running manually: ${manualCommand}`
					: 'The setcap command failed. Ensure PolicyKit is installed.',
			action: { label: 'Try Again', type: 'setup' },
			documentation:
				'https://github.com/seijikohara/kogu/blob/main/docs/network-scanner/linux-setup.md',
		};
	}

	// Permission denied
	if (ERROR_PATTERNS.permissionDenied.test(lowerMessage)) {
		if (currentPlatform === 'macos') {
			return {
				title: 'Permission Denied',
				description: 'Check System Settings → Privacy & Security for required permissions.',
				action: {
					label: 'View Guide',
					type: 'link',
					url: 'https://github.com/seijikohara/kogu/blob/main/docs/network-scanner/macos-setup.md',
				},
				documentation:
					'https://github.com/seijikohara/kogu/blob/main/docs/network-scanner/macos-setup.md',
			};
		}
		if (currentPlatform === 'linux') {
			return {
				title: 'Permission Denied',
				description: 'The scanner needs network capabilities. Click Setup Privileges to configure.',
				action: { label: 'Setup Privileges', type: 'setup' },
				documentation:
					'https://github.com/seijikohara/kogu/blob/main/docs/network-scanner/linux-setup.md',
			};
		}
		return {
			title: 'Permission Denied',
			description: 'Elevated privileges are required for this operation.',
			documentation:
				'https://github.com/seijikohara/kogu/blob/main/docs/network-scanner/troubleshooting.md',
		};
	}

	// Timeout
	if (ERROR_PATTERNS.timeout.test(lowerMessage)) {
		return {
			title: 'Operation Timed Out',
			description: 'The operation took too long. Try again or reduce the target range.',
		};
	}

	// Generic fallback
	return {
		title: 'Privilege Setup Failed',
		description: message || 'An unknown error occurred during privilege setup.',
		action: { label: 'Try Again', type: 'setup' },
		documentation:
			'https://github.com/seijikohara/kogu/blob/main/docs/network-scanner/troubleshooting.md',
	};
};

/**
 * Get platform-specific setup instructions.
 */
export const getPlatformSetupInstructions = (platform?: Platform): string => {
	const currentPlatform = platform ?? detectPlatform();

	switch (currentPlatform) {
		case 'macos':
			return `1. Click "Setup Privileges"
2. Go to System Settings → General → Login Items & Extensions
3. Enable Kogu in the list
4. Return to Kogu and try again`;

		case 'linux':
			return `1. Click "Setup Privileges"
2. Enter your password when prompted
3. Advanced scanning methods will be enabled`;

		case 'windows':
			return 'Privileged scanning is not currently supported on Windows. Use TCP Connect and other unprivileged methods.';

		default:
			return 'Click "Setup Privileges" to enable advanced scanning methods.';
	}
};
