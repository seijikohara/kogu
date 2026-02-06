# Network Scanner

The Network Scanner tool discovers devices on your local network using multiple discovery methods.

## Discovery Methods

| Method       | Requires Privileges | Description                                             |
| ------------ | ------------------- | ------------------------------------------------------- |
| TCP Connect  | No                  | Attempts TCP connections to common ports                |
| mDNS/Bonjour | No                  | Discovers devices advertising services via mDNS         |
| SSDP/UPnP    | No                  | Discovers UPnP-enabled devices (routers, media servers) |
| WS-Discovery | No                  | Discovers Windows devices and printers                  |
| ARP Cache    | No                  | Reads the OS ARP cache for recently seen devices        |
| UDP Scan     | No                  | Discovers devices responding to UDP probes              |
| ICMP Ping    | Yes                 | Sends ICMP echo requests (traditional ping)             |
| ARP Scan     | Yes                 | Actively scans the network for MAC addresses            |
| TCP SYN      | Yes                 | Half-open scanning (stealthier than TCP Connect)        |

## Why Privileges Are Needed

Some discovery methods require raw socket access:

- **ICMP Ping**: Requires raw ICMP socket
- **ARP Scan**: Requires libpcap and raw socket access
- **TCP SYN**: Requires raw TCP socket for half-open scanning

These operations typically require root/administrator privileges. Kogu uses a separate privileged sidecar binary (`net-scanner`) to perform these operations securely.

## Setup Guides

- [macOS Setup](macos-setup.md) - SMAppService daemon registration
- [Linux Setup](linux-setup.md) - setcap capabilities configuration
- [Troubleshooting](troubleshooting.md) - Common issues and solutions

## Architecture

```
┌─────────────────────────────────────────────┐
│  Kogu App (unprivileged)                    │
│  - Frontend UI                              │
│  - Tauri backend                            │
└──────────────────┬──────────────────────────┘
                   │ JSON IPC
                   ▼
┌─────────────────────────────────────────────┐
│  net-scanner sidecar (privileged)           │
│  - Raw socket operations                    │
│  - ICMP, ARP, TCP SYN scanning              │
└─────────────────────────────────────────────┘
```

This architecture follows the principle of least privilege: only the network scanning operations run with elevated permissions, while the main application remains unprivileged.

## Feature Comparison

| Feature          | Without Privileges      | With Privileges                 |
| ---------------- | ----------------------- | ------------------------------- |
| Host discovery   | TCP Connect, mDNS, SSDP | All methods including ICMP, ARP |
| MAC addresses    | From ARP cache only     | Direct ARP scanning             |
| Stealth scanning | No                      | Yes (TCP SYN)                   |
| IPv6 support     | Limited                 | Full                            |

Even without privileges, the Network Scanner can discover most devices on your network using unprivileged methods.
