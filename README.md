# Qluely Desktop Application

A desktop AI assistant application built with React, TypeScript, Vite, and Electron. Qluely provides AI-powered chat, image analysis, and screen capture functionality in a native desktop environment.

## Features

- 🤖 AI-powered chat interface
- 📸 Screen capture and image analysis
- 🎙️ Voice recording capabilities
- 🌐 Cross-platform desktop application
- ⚡ Fast development with Vite and hot reload

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Git

## Installation

1. Clone the repository:

```bash
git clone https://github.com/SSameer20/desktop.git
cd desktop
```

2. Install dependencies:

```bash
npm install
```

## Development

### Running in Development Mode

To start the application in development mode with hot reload:

```bash
npm run dev
```

This command will:

1. Build the React UI and Electron main process
2. Start the Electron application
3. Enable hot reload for both UI and main process changes

### Development Commands

- `npm run dev:web` - Start only the web development server (for UI development)
- `npm run dev:app` - Start only the Electron app (requires pre-built files)

## Building

### Build for Development

Build the application without creating distributable packages:

```bash
npm run build
```

This command will:

1. Build the React UI (`npm run build:web`)
2. Compile TypeScript for Electron main and preload processes (`npm run build:app`)

### Individual Build Commands

- `npm run build:web` - Build only the React UI
- `npm run build:app` - Build only the Electron processes

## Creating Distributable Binaries

### Build for All Platforms

To create distributable binaries for all supported platforms:

```bash
npm run app
```

This will generate platform-specific binaries in the `release/` directory.

### Platform-Specific Builds

You can also build for specific platforms using electron-builder directly:

#### macOS

```bash
npx electron-builder --mac
```

Generates: `.dmg` file for macOS

#### Windows

```bash
npx electron-builder --win
```

Generates:

- NSIS installer (`.exe`)
- Portable executable

#### Linux

```bash
npx electron-builder --linux
```

Generates:

- AppImage (`.AppImage`)
- Debian package (`.deb`)

### Multi-Platform Build

To build for multiple platforms in one command:

```bash
npx electron-builder --mac --win --linux
```

## Output Directory

All built binaries will be placed in the `release/` directory with the following structure:

- `release/Qluely-{version}-{platform}.{ext}` - Installation packages
- `release/mac-{arch}/` - macOS app bundle
- `release/win-{arch}-unpacked/` - Windows unpacked application
- `release/linux-{arch}-unpacked/` - Linux unpacked application

## Project Structure

```
├── src/
│   ├── ui/                 # React UI components
│   │   ├── components/     # React components
│   │   ├── store/         # State management
│   │   └── styles/        # CSS styles
│   └── electron/          # Electron main process
│       ├── main.ts        # Main process entry
│       ├── preload.ts     # Preload script
│       └── config/        # Configuration files
├── dist-react/            # Built React UI
├── dist-app/             # Built Electron files
├── release/              # Distribution packages
└── assets/               # Static assets
```

## Scripts Reference

| Command             | Description                   |
| ------------------- | ----------------------------- |
| `npm run dev`       | Start development mode        |
| `npm run dev:web`   | Start only web dev server     |
| `npm run dev:app`   | Start only Electron app       |
| `npm run build`     | Build for development         |
| `npm run build:web` | Build React UI                |
| `npm run build:app` | Build Electron processes      |
| `npm run app`       | Create distributable binaries |
| `npm run lint`      | Run ESLint                    |
| `npm run preview`   | Preview built web app         |

## Configuration

- **Electron Builder**: `electron-builder.json`
- **TypeScript**: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- **Vite**: `vite.config.ts`
- **ESLint**: `eslint.config.js`

## Troubleshooting

1. **Build fails**: Make sure all dependencies are installed and Node.js version is compatible
2. **Electron won't start**: Try rebuilding with `npm run build` first
3. **Missing binaries**: Check that the build completed successfully before running `npm run app`

For detailed troubleshooting, see the [troubleshooting guide](docs/troubleshooting.md).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.
