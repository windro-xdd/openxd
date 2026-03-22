#!/bin/bash
set -e

# OpenXD installer - downloads pre-built binaries
# Usage: curl -fsSL https://install.openxd.ai | bash

REPO="windro-xdd/openxd"
INSTALL_DIR="${OPENXD_INSTALL_DIR:-$HOME/.openxd}"
BIN_DIR="${OPENXD_BIN_DIR:-$HOME/.local/bin}"

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
  linux) OS="linux" ;;
  darwin) OS="darwin" ;;
  mingw*|msys*|cygwin*) OS="windows" ;;
  *) echo "Unsupported OS: $OS"; exit 1 ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Get latest release version
echo "Fetching latest OpenXD version..."
LATEST_VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')

if [ -z "$LATEST_VERSION" ]; then
  echo "Failed to fetch latest version. Trying manual installation..."
  echo "Visit: https://github.com/$REPO/releases"
  exit 1
fi

echo "Latest version: $LATEST_VERSION"

# Construct download URL
if [ "$OS" = "windows" ]; then
  ARCHIVE="openxd-${OS}-${ARCH}.zip"
else
  ARCHIVE="openxd-${OS}-${ARCH}.tar.gz"
fi

DOWNLOAD_URL="https://github.com/$REPO/releases/download/v${LATEST_VERSION}/${ARCHIVE}"

echo "Downloading OpenXD from $DOWNLOAD_URL..."

# Create temp directory
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

# Download binary
if ! curl -fL "$DOWNLOAD_URL" -o "$TMP_DIR/$ARCHIVE"; then
  echo "Failed to download OpenXD binary"
  echo "Make sure the release exists: https://github.com/$REPO/releases/tag/v${LATEST_VERSION}"
  exit 1
fi

# Extract
echo "Installing OpenXD to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

if [ "$OS" = "windows" ]; then
  unzip -q "$TMP_DIR/$ARCHIVE" -d "$INSTALL_DIR"
else
  tar -xzf "$TMP_DIR/$ARCHIVE" -C "$INSTALL_DIR"
fi

# Create symlink
mkdir -p "$BIN_DIR"

BIN="$INSTALL_DIR/openxd"
if [ ! -f "$BIN" ] && [ -f "$INSTALL_DIR/opencode" ]; then
  BIN="$INSTALL_DIR/opencode"
fi

if [ ! -f "$BIN" ]; then
  echo "Installed archive did not contain expected binary (openxd/opencode)"
  exit 1
fi

ln -sf "$BIN" "$BIN_DIR/openxd"
TARGET="$BIN_DIR/openxd"

if [ -w "/usr/local/bin" ]; then
  ln -sf "$BIN" "/usr/local/bin/openxd"
  TARGET="/usr/local/bin/openxd"
fi

hash -r 2>/dev/null || true

# Check if command is available in current shell
if ! command -v openxd >/dev/null 2>&1; then
  echo ""
  echo "⚠️  'openxd' is installed but not on your current PATH."
  echo ""
  echo "Add $BIN_DIR to your PATH:"
  echo "  export PATH=\"$BIN_DIR:\$PATH\""
  echo ""
  echo "Then reload your shell config (~/.bashrc, ~/.zshrc, etc.)"
  echo "Or run directly: $TARGET"
fi

echo ""
echo "✅ OpenXD installed successfully!"
echo ""
echo "Run: $TARGET"
