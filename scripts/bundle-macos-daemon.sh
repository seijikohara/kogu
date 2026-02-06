#!/bin/bash
#
# Bundle NetScannerDaemon into the macOS app bundle
#
# This script copies the daemon binary and launchd plist into the correct
# locations within the app bundle for SMAppService to discover them.
#
# Usage: ./scripts/bundle-macos-daemon.sh [release|debug]
#
# Requirements:
# - Must be run after `tauri build` completes
# - Swift packages must be built

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_DIR="$PROJECT_ROOT/src-tauri"

# Configuration (default to release)
CONFIG="${1:-release}"
ARCH="$(uname -m)"

# Map architecture names
if [ "$ARCH" = "arm64" ]; then
    SWIFT_ARCH="arm64"
elif [ "$ARCH" = "x86_64" ]; then
    SWIFT_ARCH="x86_64"
else
    echo "Error: Unsupported architecture: $ARCH"
    exit 1
fi

# Paths
APP_BUNDLE="$PROJECT_ROOT/target/$CONFIG/bundle/macos/Kogu.app"
DAEMON_BUILD_DIR="$TAURI_DIR/swift/NetScannerDaemon/.build/${SWIFT_ARCH}-apple-macosx/$CONFIG"
DAEMON_BINARY="$DAEMON_BUILD_DIR/NetScannerDaemon"
PLIST_SOURCE="$TAURI_DIR/resources/macos/io.github.seijikohara.kogu.NetScannerDaemon.plist"

# Target directories within app bundle
LAUNCH_SERVICES_DIR="$APP_BUNDLE/Contents/Library/LaunchServices"
LAUNCH_DAEMONS_DIR="$APP_BUNDLE/Contents/Library/LaunchDaemons"

echo "Bundling NetScannerDaemon for macOS..."
echo "  Config: $CONFIG"
echo "  Arch: $SWIFT_ARCH"
echo "  App Bundle: $APP_BUNDLE"

# Check prerequisites
if [ ! -d "$APP_BUNDLE" ]; then
    echo "Error: App bundle not found at $APP_BUNDLE"
    echo "Please run 'bun run tauri build' first."
    exit 1
fi

if [ ! -f "$DAEMON_BINARY" ]; then
    echo "Error: Daemon binary not found at $DAEMON_BINARY"
    echo "Please ensure Swift packages are built."
    exit 1
fi

if [ ! -f "$PLIST_SOURCE" ]; then
    echo "Error: Launchd plist not found at $PLIST_SOURCE"
    exit 1
fi

# Create directories
mkdir -p "$LAUNCH_SERVICES_DIR"
mkdir -p "$LAUNCH_DAEMONS_DIR"

# Copy daemon binary
echo "  Copying daemon binary..."
cp "$DAEMON_BINARY" "$LAUNCH_SERVICES_DIR/NetScannerDaemon"
chmod 755 "$LAUNCH_SERVICES_DIR/NetScannerDaemon"

# Copy launchd plist
echo "  Copying launchd plist..."
cp "$PLIST_SOURCE" "$LAUNCH_DAEMONS_DIR/io.github.seijikohara.kogu.NetScannerDaemon.plist"

# Also copy net-scanner binary to LaunchServices (daemon needs it)
NET_SCANNER_BINARY="$PROJECT_ROOT/target/$CONFIG/net-scanner"
if [ -f "$NET_SCANNER_BINARY" ]; then
    echo "  Copying net-scanner binary..."
    cp "$NET_SCANNER_BINARY" "$LAUNCH_SERVICES_DIR/net-scanner"
    chmod 755 "$LAUNCH_SERVICES_DIR/net-scanner"
fi

echo ""
echo "Done! Bundle structure:"
echo "  $LAUNCH_SERVICES_DIR/"
ls -la "$LAUNCH_SERVICES_DIR/"
echo ""
echo "  $LAUNCH_DAEMONS_DIR/"
ls -la "$LAUNCH_DAEMONS_DIR/"
echo ""
echo "Note: For SMAppService to work, the app must be signed with a Developer ID"
echo "and notarized. Without proper signing, the daemon will not be recognized."
