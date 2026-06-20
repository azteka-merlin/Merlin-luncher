const { app, BrowserWindow, ipcMain, dialog, Menu, safeStorage, session } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { exec, execFile } = require('child_process');
const axios = require('axios');
const AdmZip = require('adm-zip');

const { createConfigStore } = require('./src/main/config/config-store');
const { createAuthSession } = require('./src/main/auth/auth-session');
const { installLuaFile } = require('./src/main/files/lua-transformer');
const { createAddGamesService } = require('./src/main/games/add-games-service');
const { createGameNameResolver } = require('./src/main/games/game-name-resolver');
const { createGameQueue } = require('./src/main/games/game-queue');
const { createGameInstaller } = require('./src/main/games/game-installer');
const { parseSteamGameLink } = require('./src/main/games/steam-link-parser');
const { registerExistingIpc } = require('./src/main/ipc/register-existing-ipc');
const { registerAuthIpc } = require('./src/main/ipc/register-auth-ipc');
const { registerGamesIpc } = require('./src/main/ipc/register-games-ipc');
const { registerLibraryIpc } = require('./src/main/ipc/register-library-ipc');
const { createLibraryNameResolver } = require('./src/main/library/library-name-resolver');
const { createLibraryNameStore } = require('./src/main/library/library-name-store');
const { createLibraryService } = require('./src/main/library/library-service');
const { createDllInstaller } = require('./src/main/lumacore/dll-installer');
const { createArchiveClient } = require('./src/main/network/archive-client');
const { createApiAgent } = require('./src/main/network/api-agent');
const { createMachineIdentity } = require('./src/main/security/machine-identity');
const { REQUIRED_DLLS, createSteamService } = require('./src/main/steam/steam-service');

let mainWindow;

const menuTranslations = {
    ptbr: { help: 'Ajuda', tutorial: 'Tutorial' },
    en: { help: 'Help', tutorial: 'Tutorial' },
    es: { help: 'Ayuda', tutorial: 'Tutorial' },
    fr: { help: 'Aide', tutorial: 'Tutoriel' },
    de: { help: 'Hilfe', tutorial: 'Tutorial' }
};

function setApplicationMenu(language = 'en') {
    const labels = menuTranslations[language] || menuTranslations.en;
    Menu.setApplicationMenu(Menu.buildFromTemplate([
        {
            label: labels.help,
            submenu: [{
                label: labels.tutorial,
                click: () => mainWindow?.webContents.send('tutorial:open')
            }]
        }
    ]));
}

function configureYouTubePlayerRequests() {
    session.defaultSession.webRequest.onBeforeSendHeaders(
        {
            urls: [
                '*://*.youtube.com/*',
                '*://youtube.com/*',
                '*://*.youtube-nocookie.com/*',
                '*://youtube-nocookie.com/*',
                '*://*.googlevideo.com/*'
            ]
        },
        (details, callback) => {
            details.requestHeaders.Referer = 'https://merlin.local/';
            callback({ requestHeaders: details.requestHeaders });
        }
    );
}

function isAllowedSteamUrl(value) {
    try {
        const { protocol, hostname } = new URL(value);
        if (protocol !== 'https:' && protocol !== 'http:') return false;
        return hostname === 'steampowered.com'
            || hostname.endsWith('.steampowered.com')
            || hostname === 'steamcommunity.com'
            || hostname.endsWith('.steamcommunity.com');
    } catch {
        return false;
    }
}

// Development and installed builds must never compete for Chromium cache files.
if (!app.isPackaged) {
    const devDataRoot = path.join(
        process.env.LOCALAPPDATA || app.getPath('appData'),
        'Merlin',
        'Development'
    );
    const devUserData = path.join(devDataRoot, 'User Data');
    const devSessionData = path.join(devDataRoot, 'Session Data');
    fs.mkdirSync(devUserData, { recursive: true });
    fs.mkdirSync(devSessionData, { recursive: true });
    app.setPath('userData', devUserData);
    app.setPath('sessionData', devSessionData);
}

function getConfigFilePath() {
    return app.isPackaged
        ? path.join(app.getPath('userData'), 'config.json')
        : path.join(__dirname, 'config.json');
}

function getLibraryFilePath() {
    return path.join(app.getPath('userData'), 'library.json');
}

function getBundledDllPath(dll) {
    const dllDirectory = app.isPackaged
        ? path.join(process.resourcesPath, 'dlls')
        : path.join(__dirname, 'assets', 'dlls');
    return path.join(dllDirectory, dll);
}

const configStore = createConfigStore({
    fs,
    path,
    getFilePath: getConfigFilePath,
    defaults: { steamPath: '', language: 'ptbr', tutorialPromptSeen: true }
});

const steamService = createSteamService({
    fs,
    path,
    exec,
    platform: process.platform,
    userProfile: process.env.USERPROFILE
});

const apiBaseUrl = process.env.MERLIN_API_BASE_URL
    || 'https://merlin-api.azteka-merlin.workers.dev/api';
const manifestApiUrl = process.env.MERLIN_API_URL || `${apiBaseUrl}/manifests`;
const apiAgent = createApiAgent();
const machineIdentity = createMachineIdentity({ crypto, execFile, os });
const authSession = createAuthSession({
    app,
    safeStorage,
    fs,
    path,
    axios,
    httpsAgent: apiAgent,
    machineIdentity,
    baseUrl: apiBaseUrl,
    onAuthRequired: code => mainWindow?.webContents.send('auth:required', { code })
});
const archiveClient = createArchiveClient({ axios, httpsAgent: apiAgent });

const libraryService = createLibraryService({
    fs,
    path,
    configStore,
    nameStore: createLibraryNameStore({ fs, path, getFilePath: getLibraryFilePath }),
    nameResolver: createLibraryNameResolver({ axios }),
    steamService
});

const gameInstaller = createGameInstaller({
    app,
    fs,
    path,
    AdmZip,
    archiveClient,
    authSession,
    manifestApiUrl,
    steamService,
    installLuaFile,
    onInstalled: () => libraryService.invalidate()
});

const addGamesService = createAddGamesService({
    parseSteamGameLink,
    nameResolver: createGameNameResolver({ axios }),
    queue: createGameQueue(),
    gameInstaller,
    configStore,
    steamService,
    libraryService
});

const dllInstaller = createDllInstaller({
    fs,
    path,
    dialog,
    requiredDlls: REQUIRED_DLLS,
    getSourcePath: getBundledDllPath,
    getMainWindow: () => mainWindow
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 800,
        frame: true,
        backgroundColor: '#1a1a2e',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: !app.isPackaged,
            webviewTag: true
        },
        icon: path.join(__dirname, 'assets/icon.png')
    });

    mainWindow.loadFile('index.html');
    mainWindow.on('closed', () => { mainWindow = null; });
}

registerExistingIpc({
    ipcMain,
    dialog,
    configStore,
    steamService,
    dllInstaller,
    gameInstaller,
    libraryService,
    getMainWindow: () => mainWindow
});

registerGamesIpc({ ipcMain, addGamesService });
registerLibraryIpc({ ipcMain, libraryService });
registerAuthIpc({ ipcMain, authSession });
ipcMain.handle('app:set-menu-language', (_event, language) => {
    setApplicationMenu(language);
    return { success: true };
});

app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
        if (contents.getType() === 'webview' && isAllowedSteamUrl(url)) {
            setImmediate(() => {
                if (!contents.isDestroyed()) contents.loadURL(url);
            });
        }
        return { action: 'deny' };
    });

    contents.on('devtools-opened', () => {
        if (app.isPackaged) contents.closeDevTools();
    });
});

app.whenReady().then(() => {
    configStore.load();
    configureYouTubePlayerRequests();
    setApplicationMenu(configStore.get().language);
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
