#!/usr/bin/env bash

set -e

echo "Detecting OS..."

OS="$(uname -s)"

# Create base resources directory
mkdir -p resources

if [[ "$OS" == "Darwin" ]]; then
    echo "MacOS detected"

    TARGET_DIR="resources/ffmpeg/darwin"
    mkdir -p "$TARGET_DIR"

    echo "Downloading FFmpeg for macOS..."
    curl -L https://evermeet.cx/ffmpeg/getrelease/zip -o ffmpeg.zip

    echo "Unzipping..."
    unzip -o ffmpeg.zip

    echo "Moving binary..."
    mv ffmpeg "$TARGET_DIR/ffmpeg"
    chmod +x "$TARGET_DIR/ffmpeg"

    rm ffmpeg.zip

    echo "Done. Saved to $TARGET_DIR/ffmpeg"

elif [[ "$OS" == "MINGW"* ]] || [[ "$OS" == "MSYS"* ]] || [[ "$OS" == "CYGWIN"* ]]; then
    echo "Windows detected"

    TARGET_DIR="resources/ffmpeg/win32"
    mkdir -p "$TARGET_DIR"

    echo "Downloading FFmpeg for Windows..."
    curl  https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip -o ffmpeg.zip

    echo "Unzipping..."
    unzip -o ffmpeg.zip

    EXTRACTED_FOLDER=$(find . -type d -name "ffmpeg-*essentials_build" | head -n 1)

    echo "Moving ffmpeg.exe..."
    mv "$EXTRACTED_FOLDER/bin/ffmpeg.exe" "$TARGET_DIR/ffmpeg.exe"

    rm -rf "$EXTRACTED_FOLDER"
    rm ffmpeg.zip

    echo "Done. Saved to $TARGET_DIR/ffmpeg.exe"

else
    echo "Unsupported OS: $OS"
    exit 1
fi

echo "FFmpeg setup complete."
