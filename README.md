# Kogu

A collection of developer tools built with Tauri, SvelteKit, and TypeScript.

## Download

Download the latest release from the [Releases page](https://github.com/seijikohara/kogu/releases).

### Installation Notes

#### macOS

The app is not notarized by Apple. On first launch, you may see a message saying the app "cannot be opened because the developer cannot be verified."

**To open the app:**

1. Try to open the app (it will be blocked)
2. Go to **System Settings → Privacy & Security**
3. Scroll down and click **Open Anyway**
4. Confirm by clicking **Open**

Alternatively, run this command in Terminal:

```bash
xattr -cr /Applications/Kogu.app
```

#### Windows

You may see a SmartScreen warning saying "Windows protected your PC." Click **More info** → **Run anyway** to proceed.

#### Linux

No additional steps required. Make the AppImage executable and run it:

```bash
chmod +x Kogu_*.AppImage
./Kogu_*.AppImage
```

## Development

### Prerequisites

- [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/)

### Setup

```bash
# Install dependencies
bun install

# Start development server
bun run tauri dev

# Build for production
bun run tauri build
```

### Commands

| Command               | Description             |
| --------------------- | ----------------------- |
| `bun run dev`         | Start Vite dev server   |
| `bun run tauri dev`   | Start Tauri dev mode    |
| `bun run build`       | Build frontend          |
| `bun run tauri build` | Build desktop app       |
| `bun run check`       | TypeScript/Svelte check |
| `bun run format`      | Format with Prettier    |

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## License

MIT
