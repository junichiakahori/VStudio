#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_NAME="VStudio.app"
APP_DIR="$DIR/$APP_NAME"

echo "================================================="
echo "🔨 Building Native VStudio.app (Dedicated Window)..."
echo "================================================="

# 1. Generate icon if not present
if [ ! -f "$DIR/AppIcon.icns" ]; then
    echo "🎨 Generating AppIcon.icns..."
    python3 "$DIR/scripts/make_icon.py"
fi

# 2. Re-create App Bundle structure
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# 3. Copy Icon
cp "$DIR/AppIcon.icns" "$APP_DIR/Contents/Resources/AppIcon.icns"

# 4. Create Info.plist
cat << 'EOF' > "$APP_DIR/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>VStudio</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.vstudio.app</string>
    <key>CFBundleName</key>
    <string>VStudio</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>2.0</string>
    <key>CFBundleVersion</key>
    <string>2</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <true/>
        <key>NSAllowsArbitraryLoadsInWebContent</key>
        <true/>
        <key>NSAllowsLocalNetworking</key>
        <true/>
    </dict>
    <key>NSMicrophoneUsageDescription</key>
    <string>VStudio requires microphone access for voice input and live audio.</string>
    <key>NSCameraUsageDescription</key>
    <string>VStudio requires camera access for motion tracking.</string>
</dict>
</plist>
EOF

# 5. Compile Swift Native App Binary
echo "⚡ Compiling Swift Native Dedicated App..."
swiftc "$DIR/src_native/main.swift" \
    -O \
    -target arm64-apple-macos11.3 \
    -framework Cocoa \
    -framework WebKit \
    -framework UniformTypeIdentifiers \
    -o "$APP_DIR/Contents/MacOS/VStudio"

# 6. Create Desktop Shortcut / Copy
DESKTOP_PATH="$HOME/Desktop/VStudio.app"
rm -rf "$DESKTOP_PATH"
cp -R "$APP_DIR" "$DESKTOP_PATH"

echo "================================================="
echo "🎉 専用画面付き VStudio.app のビルドが完了しました！"
echo "📁 アプリの場所: $APP_DIR"
echo "🖥️ デスクトップにも配置しました: $DESKTOP_PATH"
echo "================================================="
