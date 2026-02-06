# macOS Privilege Setup

This guide explains how to set up privileges for the Network Scanner on macOS.

## Overview

On macOS 13+, Kogu uses Apple's SMAppService to register a privileged helper daemon. This daemon runs with elevated privileges and handles network scanning operations.

## Setup Steps

### 1. Click Setup Privileges

In the Network Scanner, click the **Setup Privileges** button in the warning banner.

### 2. Approve in System Settings

After clicking Setup Privileges:

1. Open **System Settings**
2. Navigate to **General → Login Items & Extensions**
3. Find **Kogu** in the list
4. Enable the toggle next to Kogu

### 3. Return to Kogu

After enabling Kogu in Login Items:

1. Return to the Kogu app
2. The warning banner should disappear
3. ICMP Ping, ARP Scan, and TCP SYN methods are now available

## Verification

To verify the setup was successful:

1. Open Network Scanner
2. Check that "ICMP Ping", "ARP Scan", and "TCP SYN" checkboxes are enabled
3. Run a scan - these methods should now work

## How It Works

1. **SMAppService Registration**: Kogu registers the `NetScannerDaemon` as a Login Item
2. **User Approval**: macOS requires explicit user approval in System Settings
3. **Daemon Execution**: The daemon runs with root privileges when network scanning is requested
4. **XPC Communication**: Kogu communicates with the daemon via XPC (Apple's inter-process communication)

## Security

- The daemon only runs when network scanning is active
- Communication is verified using code signing
- The daemon is sandboxed to network operations only
- User approval is required before the daemon can run

## Removing Privileges

To remove the daemon:

1. Go to **System Settings → General → Login Items & Extensions**
2. Disable **Kogu** in the list

Or run in Terminal:

```bash
# Unregister the daemon
launchctl bootout gui/$(id -u) io.github.seijikohara.kogu.NetScannerDaemon
```

## Legacy macOS (< 13)

On macOS versions before 13, a different approach using setuid is used. The setup process is similar but uses `osascript` for privilege escalation.

## Troubleshooting

See [troubleshooting.md](troubleshooting.md) for common issues.
