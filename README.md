<div align="center">

# Merlin

### Modern Electron application for Steam Lua and Manifest management

</div>

## Features

### Core Functionality
- **Integrated Web Browser** - Browse Steam Store and SteamDB directly in the app
- **Automatic App ID Detection** - Automatically detects Steam game App IDs from URLs
- **Background Downloads** - Routed through Merlin API, which handles upstream fallbacks centrally
- **Smart Steam Management** - Automatically restarts Steam after installation
- **LumaCore Integration** - Builds and packages the required `LumaCore.dll` and `dwmapi.dll`

### User Experience
- **Experimental Gamepad Support** - Control the entire app with Xbox/PlayStation controllers
- **Multi-language** - Available in Brazilian Portuguese, English, French, Spanish, and German
- **Modern UI** - Clean, minimalist design with smooth transitions

### Technical
- Built with **Electron 33** for cross-platform desktop experience
- **Chromium-based** web browsing for optimal compatibility
- **IPC architecture** for secure communication
- Build-time JavaScript obfuscation and hardened Electron Fuses

---

## Requirements

- **Node.js** v18 or higher
- **npm** or **yarn**
- **Steam** installed on your system
- **Windows 10/11** (Linux/macOS support planned)
- To build from source: **CMake 3.20+**, **Visual Studio Build Tools 2022**
  with the C++ workload, and a Windows SDK

---

## Installation

### Option 1: Executable (Recommended)

Download the latest installer from the [releases](https://github.com/devGaSantos/Merlin/releases) page and run it.

The Windows installer requests administrator permission. If Steam is found at
the default `C:\Program Files (x86)\Steam` location, it automatically installs
the generated `LumaCore.dll` and `dwmapi.dll` there. Steam installations in
custom locations can still be configured and repaired from inside Merlin.

### Option 2: From Source

1. **Clone the repository**
```bash
   git clone https://github.com/devGaSantos/Merlin.git
   cd merlin
```

2. **Install dependencies**
```bash
   npm install
```

3. **Run the application**
```bash
   npm start
```

### Option 3: Quick Start (Windows)

Simply double-click `start.bat` - it will automatically:
- Check for Node.js installation
- Install or update Node.js dependencies
- Validate the local `.env` and generate the encrypted development security bundle
- Check that the required LumaCore DLLs are available
- Launch the application

The launcher prepares everything required to **run** Merlin. Building the native
DLLs still requires CMake and Visual Studio Build Tools 2022; if they are absent,
the launcher shows the command that must be run after installing those tools.

### Option 4: Build Executable

```bash
npm run build
```
This first builds the Release version of `LumaCore.dll` and `dwmapi.dll`, copies
them to `assets/dlls`, then packages those generated DLLs with Merlin. The `.exe`
file will be generated in the `dist/` folder.

To build only the DLLs during development:

```bash
npm run build:lumacore
```

---

## Usage

### Initial Setup

1. **Launch the application**
2. Click **"Auto Detect"** to find your Steam installation
3. If detection fails, use **"Browse"** to manually select your Steam folder

### Adding a Game

1. **Navigate** to a game page on Steam Store or SteamDB
2. The **App ID** will be detected automatically
3. Click **"Add to Steam"**
4. Wait for download and installation to complete
5. Click **"Restart Steam"** to see the game in your library

### Supported File Types

| File | Destination |
|------|-------------|
| `.manifest` | `Steam\depotcache\` |
| `.lua` | `Steam\config\stplug-in\` |

Before installing a `.lua` file, Merlin comments out every active line containing
`setmanifestid(` by prefixing the whole line with `--`. Lines already commented
remain unchanged.

---

## Gamepad Support (Experimental)

| Button | Action |
|--------|--------|
| **A** (Xbox) / **✕** (PS) | Select highlighted element |
| **B** (Xbox) / **○** (PS) | Back |
| **X** (Xbox) / **□** (PS) | Add to Steam |
| **Y** (Xbox) / **△** (PS) | Restart Steam |
| **D-Pad Up/Down** | Navigate UI elements |
| **D-Pad Left/Right** | Web navigation (Back/Forward) |
| **LB/RB** | Scroll page |
| **Start** | Home |
| **Left Stick** | Scroll page |

Connect your controller before launching the app. The controller indicator will appear when detected.

---

## Languages

- 🇧🇷 **Português (Brasil)**
- 🇬🇧 **English**
- 🇫🇷 **Français**
- 🇪🇸 **Español**
- 🇩🇪 **Deutsch**

Change language via the dropdown in the top-right corner.

---

## Tech Stack

- **[Electron](https://www.electronjs.org/)** - Desktop application framework
- **[Node.js](https://nodejs.org/)** - JavaScript runtime
- **[Axios](https://axios-http.com/)** - HTTP client for downloads
- **[AdmZip](https://www.npmjs.com/package/adm-zip)** - ZIP file extraction
- **Gamepad API** - Native controller support
- **WebView** - Integrated web browsing

---

## Project Structure

```text
Merlin/
|-- assets/             Icons and generated DLLs used by the application
|-- LumaCore/           Native C++ component and its build system
|-- scripts/            Electron packaging and hardening hooks
|-- src/
|   |-- main/           Config, Steam, downloads, DLLs, security, and IPC modules
|   `-- renderer/       Feature-specific renderer modules
|-- test/               Node regression and contract tests
|-- build.js            LumaCore + Electron secured build pipeline
|-- main.js             Electron composition and application lifecycle
|-- preload.js          Restricted IPC bridge
|-- renderer.js         Existing Steam browsing interface logic
`-- package.json        Node.js dependencies, tests, and packaging configuration
```

---

## Credits

### LumaCore

Merlin integrates and distributes DLLs built from
[KoriaPolis/LumaCore](https://github.com/KoriaPolis/LumaCore). LumaCore was
written by **Midrag** for the **SteaMidra** project.

LumaCore acknowledges
[OpenSteamTool](https://github.com/OpenSteam001/OpenSteamTool) as an early
inspiration and uses third-party components including Microsoft Detours, Lua,
spdlog, toml++, and Protocol Buffers. Full acknowledgements are available in
[`LumaCore/CREDITS.md`](LumaCore/CREDITS.md).

### License notice

LumaCore and the DLLs generated from it are distributed under the
**GNU General Public License v3.0**. Its license text is available in
[`LumaCore/LICENSE`](LumaCore/LICENSE). Other Merlin components and third-party
dependencies retain their respective licenses.
