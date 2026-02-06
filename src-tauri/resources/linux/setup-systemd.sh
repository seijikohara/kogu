#!/bin/bash
# Kogu Network Scanner - systemd user service setup script
# This script installs and enables the systemd user service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_SERVICE_DIR="${HOME}/.config/systemd/user"
SCANNER_PATH="${1:-/usr/lib/kogu/net-scanner}"

echo "Kogu Network Scanner - systemd setup"
echo "====================================="

# Check if systemd user session is available
if ! systemctl --user status >/dev/null 2>&1; then
    echo "Error: systemd user session is not available."
    echo "This script requires systemd with user sessions enabled."
    exit 1
fi

# Create user service directory
mkdir -p "${USER_SERVICE_DIR}"

# Copy service files
echo "Installing service files..."
cp "${SCRIPT_DIR}/kogu-net-scanner.socket" "${USER_SERVICE_DIR}/"
cp "${SCRIPT_DIR}/kogu-net-scanner.service" "${USER_SERVICE_DIR}/"

# Update ExecStart path in service file
sed -i "s|^# ExecStart=.*|ExecStart=${SCANNER_PATH}|" \
    "${USER_SERVICE_DIR}/kogu-net-scanner.service"

# Reload systemd
echo "Reloading systemd user daemon..."
systemctl --user daemon-reload

# Enable and start socket
echo "Enabling socket activation..."
systemctl --user enable kogu-net-scanner.socket

echo "Starting socket..."
systemctl --user start kogu-net-scanner.socket

# Verify
if systemctl --user is-active --quiet kogu-net-scanner.socket; then
    echo ""
    echo "Setup complete!"
    echo "The Network Scanner will now use systemd socket activation."
else
    echo ""
    echo "Warning: Socket failed to start. Check with:"
    echo "  systemctl --user status kogu-net-scanner.socket"
fi
