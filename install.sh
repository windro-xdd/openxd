#!/bin/bash
set -e

echo "🚀 Installing OpenXD..."

# Detect OS
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
    Linux*)     OS_TYPE="linux";;
    Darwin*)    OS_TYPE="macos";;
    MINGW*|MSYS*|CYGWIN*) OS_TYPE="windows";;
    *)          echo "❌ Unsupported OS: $OS"; exit 1;;
esac

case "$ARCH" in
    x86_64|amd64)   ARCH_TYPE="x64";;
    aarch64|arm64)  ARCH_TYPE="arm64";;
    *)              echo "❌ Unsupported architecture: $ARCH"; exit 1;;
esac

echo "📦 Detected: $OS_TYPE-$ARCH_TYPE"

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "📥 Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
fi

# Install OpenXD
INSTALL_DIR="$HOME/.openxd"
echo "📂 Installing to $INSTALL_DIR"

# Clone repo
if [ -d "$INSTALL_DIR" ]; then
    echo "🔄 Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull origin dev
else
    echo "📥 Cloning repository..."
    git clone -b dev https://github.com/windro-xdd/openxd.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Install dependencies and build
echo "🔨 Building OpenXD..."
bun install
cd packages/opencode
bun run build

# Create symlink
BIN_PATH="$HOME/.local/bin/openxd"
mkdir -p "$HOME/.local/bin"

if [ -L "$BIN_PATH" ] || [ -f "$BIN_PATH" ]; then
    rm "$BIN_PATH"
fi

ln -s "$INSTALL_DIR/packages/opencode/bin/opencode.cjs" "$BIN_PATH"
chmod +x "$INSTALL_DIR/packages/opencode/bin/opencode.cjs"

# Add to PATH if needed
SHELL_RC="$HOME/.bashrc"
if [ -n "$ZSH_VERSION" ]; then
    SHELL_RC="$HOME/.zshrc"
fi

if ! grep -q '.local/bin' "$SHELL_RC" 2>/dev/null; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_RC"
    echo "✅ Added $HOME/.local/bin to PATH in $SHELL_RC"
fi

echo ""
echo "✨ OpenXD installed successfully!"
echo ""
echo "Run: source $SHELL_RC"
echo "Then: openxd --help"
echo ""
