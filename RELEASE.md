# OpenXD Release Process

## Binary Releases

OpenXD provides pre-built binaries for all major platforms. No compilation needed!

### Installation

```bash
curl -fsSL https://install.openxd.ai | bash
```

Or download directly from: https://github.com/windro-xdd/openxd/releases

### Supported Platforms

- **Linux**: x64, x64-baseline, arm64 (glibc and musl)
- **macOS**: arm64 (Apple Silicon), x64 (Intel)
- **Windows**: x64, x64-baseline

## Creating a Release

1. **Tag a version:**

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **GitHub Actions automatically:**
   - Builds binaries for all platforms
   - Creates a GitHub Release
   - Uploads all binaries as release assets

3. **Users install via:**
   ```bash
   curl -fsSL https://install.openxd.ai | bash
   ```

## Manual Build (Development Only)

If you need to build from source during development:

```bash
cd packages/opencode
bun install
bun run script/build.ts --single
```

This creates a binary in `dist/opencode-{platform}-{arch}/bin/opencode`

## Install Script Setup

For `https://install.openxd.ai` to work, point the domain to `install.sh`:

### Option 1: GitHub Pages (Simple)

Create `docs/index.html`:

```html
<script>
  window.location = "https://raw.githubusercontent.com/windro-xdd/openxd/main/install.sh"
</script>
```

### Option 2: Redirect Service

Use a URL shortener or redirect service to point to:

```
https://raw.githubusercontent.com/windro-xdd/openxd/main/install.sh
```

### Option 3: CDN (Recommended)

Host on Cloudflare/Vercel with:

```
https://install.openxd.ai → raw.githubusercontent.com/windro-xdd/openxd/main/install.sh
```
