# Linux Privilege Setup

This guide explains how to set up privileges for the Network Scanner on Linux.

## Overview

On Linux, Kogu uses POSIX capabilities to grant the `net-scanner` binary the ability to create raw sockets without running as root.

## Setup Steps

### 1. Click Setup Privileges

In the Network Scanner, click the **Setup Privileges** button in the warning banner.

### 2. Enter Password

A `pkexec` (PolicyKit) dialog will appear asking for your password. This is similar to `sudo` but works with graphical applications.

### 3. Verification

After entering your password:

- The warning banner should disappear
- ICMP Ping, ARP Scan, and TCP SYN methods are now available

## Manual Setup

If `pkexec` is not available or doesn't work, you can set capabilities manually:

```bash
# Find the net-scanner binary
# For AppImage:
SCANNER=$(find ~/.config -name 'net-scanner' -type f 2>/dev/null | head -1)

# For .deb/.rpm installation:
SCANNER=/usr/lib/kogu/net-scanner

# Set capabilities
sudo setcap cap_net_raw,cap_net_admin+ep "$SCANNER"

# Verify
getcap "$SCANNER"
# Should output: /path/to/net-scanner cap_net_admin,cap_net_raw=ep
```

## Required Capabilities

| Capability      | Purpose                                    |
| --------------- | ------------------------------------------ |
| `CAP_NET_RAW`   | Create raw sockets (ICMP, ARP)             |
| `CAP_NET_ADMIN` | Network administration (interface queries) |

## PolicyKit (pkexec) Requirements

For the automatic setup to work, you need:

1. **PolicyKit daemon running**:

   ```bash
   systemctl status polkit
   ```

2. **pkexec available**:
   ```bash
   which pkexec
   ```

### Installing PolicyKit

If not installed:

```bash
# Debian/Ubuntu
sudo apt install policykit-1

# Fedora
sudo dnf install polkit

# Arch Linux
sudo pacman -S polkit
```

## How It Works

1. **Setup Request**: Kogu calls `pkexec setcap ...`
2. **Password Prompt**: PolicyKit shows a graphical password dialog
3. **Capability Grant**: `setcap` adds capabilities to the binary
4. **Persistent**: Capabilities remain until the binary is replaced

## Security

- Only the `net-scanner` binary gets elevated capabilities
- The main Kogu application runs without any special privileges
- Capabilities are more secure than running as root (minimal privilege)
- Capabilities persist until the binary is updated/replaced

## Removing Capabilities

To remove the capabilities:

```bash
sudo setcap -r /path/to/net-scanner
```

## Non-systemd Distributions

On distributions without PolicyKit (Alpine, Void, etc.):

1. Use the manual setup method above
2. Consider using a systemd user service (if systemd is available)
3. Run Kogu with `sudo` (not recommended for regular use)

## Troubleshooting

See [troubleshooting.md](troubleshooting.md) for common issues.
