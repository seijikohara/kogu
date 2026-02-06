# Network Scanner Troubleshooting

This guide covers common issues and solutions for the Network Scanner privilege setup.

## Common Issues

### "Daemon is not registered" (macOS)

**Cause**: The SMAppService daemon has not been registered.

**Solution**:

1. Click **Setup Privileges** in the Network Scanner
2. If the button doesn't appear, restart Kogu

### "Daemon requires approval" (macOS)

**Cause**: The daemon is registered but awaiting user approval in System Settings.

**Solution**:

1. Open **System Settings → General → Login Items & Extensions**
2. Find **Kogu** in the list
3. Enable the toggle next to Kogu
4. Return to Kogu and try again

### Kogu Not Appearing in Login Items (macOS)

**Cause**: The daemon registration failed or Kogu is not properly signed.

**Solution**:

1. Ensure you're running Kogu from `/Applications`
2. Try clicking **Setup Privileges** again
3. Check Console.app for `io.github.seijikohara.kogu` errors

### "net-scanner binary not found"

**Cause**: The sidecar binary is missing or not in the expected location.

**Solution**:

1. Reinstall Kogu from a fresh download
2. For development builds: `bun run tauri build`

### "setcap failed" (Linux)

**Cause**: The `setcap` command failed, usually due to missing packages or permissions.

**Solutions**:

1. **Ensure PolicyKit is installed**:

   ```bash
   # Debian/Ubuntu
   sudo apt install policykit-1

   # Fedora
   sudo dnf install polkit
   ```

2. **Try manual setup**:

   ```bash
   sudo setcap cap_net_raw,cap_net_admin+ep /path/to/net-scanner
   ```

3. **Check if setcap is available**:
   ```bash
   which setcap
   # If missing, install libcap2-bin (Debian) or libcap (Fedora)
   ```

### "Permission denied" During Scan

**Cause**: Privileges were set but are no longer valid (binary was replaced).

**Solution**:

1. Click **Setup Privileges** again to reapply capabilities
2. This commonly happens after app updates

### Scan Shows No Results

**Cause**: Not necessarily a privilege issue. Could be network configuration.

**Check**:

1. Ensure target IP range is correct
2. Verify network interface is up
3. Check firewall settings
4. Try with unprivileged methods first (TCP Connect, mDNS)

### Slow Scanning

**Cause**: Large target range or network latency.

**Solutions**:

1. Reduce the target range (e.g., `/24` instead of `/16`)
2. Reduce concurrent connections in Options
3. Use faster discovery methods (TCP Connect is usually fastest)

## Platform-Specific Issues

### macOS: "Operation not permitted"

**Cause**: Gatekeeper or SIP restrictions.

**Solution**:

```bash
xattr -cr /Applications/Kogu.app
```

### Linux: AppImage Capabilities Lost

**Cause**: AppImage extracts to a temp directory on each run.

**Workaround**:

1. Extract the AppImage permanently:
   ```bash
   ./Kogu.AppImage --appimage-extract
   cd squashfs-root
   sudo setcap cap_net_raw,cap_net_admin+ep ./resources/net-scanner
   ./AppRun
   ```
2. Or use the `.deb`/`.rpm` package instead

### Linux: pkexec Shows Text-Only Prompt

**Cause**: No graphical PolicyKit agent running.

**Solution**:

1. Install a graphical agent:

   ```bash
   # GNOME
   sudo apt install polkit-gnome

   # KDE
   sudo apt install polkit-kde-agent-1
   ```

2. Start it with your session

## Getting Help

If none of these solutions work:

1. Check the [GitHub Issues](https://github.com/seijikohara/kogu/issues)
2. Open a new issue with:
   - Your OS and version
   - Kogu version
   - Steps to reproduce
   - Any error messages

## Logs

### macOS

View daemon logs:

```bash
log stream --predicate 'subsystem == "io.github.seijikohara.kogu"' --level debug
```

### Linux

Check for capability errors:

```bash
journalctl -f | grep -i kogu
```

Or run Kogu from terminal to see output:

```bash
./Kogu.AppImage
```
