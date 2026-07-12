const { app, BrowserWindow, ipcMain, dialog, Menu, safeStorage, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { exec, execFile } = require('child_process');
const axios = require('axios');
const AdmZip = require('adm-zip');
const nodeUnrar = require('node-unrar-js');

const { createConfigStore } = require('./src/main/config/config-store');
const { createCorrectionsCatalogClient } = require('./src/main/corrections/corrections-catalog-client');
const { createCorrectionsCatalogStore } = require('./src/main/corrections/corrections-catalog-store');
const { createCorrectionsService } = require('./src/main/corrections/corrections-service');
const { createAuthSession } = require('./src/main/auth/auth-session');
const { installLuaFile } = require('./src/main/files/lua-transformer');
const { createAddGamesService } = require('./src/main/games/add-games-service');
const { createGameNameResolver } = require('./src/main/games/game-name-resolver');
const { createGameQueue } = require('./src/main/games/game-queue');
const { createGameSearchClient } = require('./src/main/games/game-search-client');
const { createGameInstaller } = require('./src/main/games/game-installer');
const { createManifestOverrideService } = require('./src/main/games/manifest-override-service');
const { parseSteamGameLink } = require('./src/main/games/steam-link-parser');
const { registerCorrectionsIpc } = require('./src/main/ipc/register-corrections-ipc');
const { registerExistingIpc } = require('./src/main/ipc/register-existing-ipc');
const { registerAuthIpc } = require('./src/main/ipc/register-auth-ipc');
const { registerGamesIpc } = require('./src/main/ipc/register-games-ipc');
const { registerLibraryIpc } = require('./src/main/ipc/register-library-ipc');
const { registerPremiumIpc } = require('./src/main/ipc/register-premium-ipc');
const { createLibraryCacheStore } = require('./src/main/library/library-cache-store');
const { createLibraryCatalogClient } = require('./src/main/library/library-catalog-client');
const { createLibraryCatalogService } = require('./src/main/library/library-catalog-service');
const { createLibraryCatalogStore } = require('./src/main/library/library-catalog-store');
const { createLibraryService } = require('./src/main/library/library-service');
const { createDllInstaller } = require('./src/main/lumacore/dll-installer');
const { createArchiveClient } = require('./src/main/network/archive-client');
const { createApiAgent } = require('./src/main/network/api-agent');
const { createDownloadManager } = require('./src/main/network/download-manager');
const { createPremiumCatalogClient } = require('./src/main/premium/premium-catalog-client');
const { createPremiumCatalogStore } = require('./src/main/premium/premium-catalog-store');
const { createPremiumService } = require('./src/main/premium/premium-service');
const { createMachineIdentity } = require('./src/main/security/machine-identity');
const { REQUIRED_STEAM_FILES, createSteamService } = require('./src/main/steam/steam-service');
const { createUpdateService } = require('./src/main/updates/update-service');

let mainWindow;

const menuTranslations = {
    ptbr: { help: 'Ajuda', tutorial: 'Tutorial', faq: 'FAQ' },
    en: { help: 'Help', tutorial: 'Tutorial', faq: 'FAQ' },
    es: { help: 'Ayuda', tutorial: 'Tutorial', faq: 'FAQ' },
    fr: { help: 'Aide', tutorial: 'Tutoriel', faq: 'FAQ' },
    de: { help: 'Hilfe', tutorial: 'Tutorial', faq: 'FAQ' }
};

function setApplicationMenu(language = 'en') {
    const labels = menuTranslations[language] || menuTranslations.en;
    Menu.setApplicationMenu(Menu.buildFromTemplate([
        {
            label: labels.help,
            submenu: [{
                label: labels.tutorial,
                click: () => mainWindow?.webContents.send('tutorial:open')
            }, {
                label: labels.faq,
                click: () => mainWindow?.webContents.send('faq:open')
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

function getLibraryCacheFilePath() {
    return path.join(app.getPath('userData'), 'library-cache.json');
}

function getLibraryCatalogFilePath() {
    return path.join(app.getPath('userData'), 'games-catalog.json');
}

function getCorrectionsCatalogFilePath() {
    return path.join(app.getPath('userData'), 'corrections-catalog.json');
}

function getPremiumCatalogFilePath() {
    return path.join(app.getPath('userData'), 'premium-catalog.json');
}

function getBundledSteamRuntimePath(file) {
    const root = app.isPackaged
        ? process.resourcesPath
        : path.join(__dirname, 'assets');

    return path.join(root, 'dlls', file.sourceName);
}

const configStore = createConfigStore({
    fs,
    path,
    getFilePath: getConfigFilePath,
    defaults: {
        steamPath: '',
        language: 'ptbr',
        tutorialPromptSeen: false,
        correctionsDisclaimerSeen: false
    }
});

const steamService = createSteamService({
    fs,
    path,
    exec,
    platform: process.platform,
    userProfile: process.env.USERPROFILE
});

const apiBaseUrl = process.env.MERLIN_API_BASE_URL
    || 'https://api-merlin.com/api';
const gameSearchApiUrl = `${apiBaseUrl}/games/search`;
const manifestApiUrl = process.env.MERLIN_API_URL || `${apiBaseUrl}/manifests`;
const manifestStatusUrl = `${manifestApiUrl}/status`;
const apiAgent = createApiAgent();
const downloadManager = createDownloadManager({ fs, path, axios, httpsAgent: apiAgent });
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
const manifestOverrideService = createManifestOverrideService({
    axios,
    httpsAgent: apiAgent,
    authSession,
    statusUrl: manifestStatusUrl
});
const updateService = createUpdateService({ app, axios, shell, path, downloadManager });
const libraryCatalogStore = createLibraryCatalogStore({
    fs,
    path,
    getFilePath: getLibraryCatalogFilePath
});
const libraryCatalogService = createLibraryCatalogService({
    catalogStore: libraryCatalogStore,
    catalogClient: createLibraryCatalogClient({ axios }),
    searchClient: createGameSearchClient({
        axios,
        authSession,
        httpsAgent: apiAgent,
        url: gameSearchApiUrl
    })
});

const libraryService = createLibraryService({
    fs,
    path,
    configStore,
    cacheStore: createLibraryCacheStore({
        fs,
        path,
        getFilePath: getLibraryCacheFilePath,
        getLegacyFilePath: getLibraryFilePath
    }),
    catalogStore: libraryCatalogStore,
    catalogService: libraryCatalogService,
    steamService,
    shell
});
const correctionsCatalogStore = createCorrectionsCatalogStore({
    fs,
    path,
    getFilePath: getCorrectionsCatalogFilePath
});
const correctionsService = createCorrectionsService({
    app,
    fs,
    path,
    AdmZip,
    nodeUnrar,
    dialog,
    shell,
    configStore,
    steamService,
    authSession,
    catalogStore: correctionsCatalogStore,
    catalogClient: createCorrectionsCatalogClient({ axios }),
    libraryCatalogService,
    downloadManager
});
const premiumCatalogStore = createPremiumCatalogStore({
    fs,
    path,
    getFilePath: getPremiumCatalogFilePath
});
const premiumService = createPremiumService({
    app,
    fs,
    path,
    AdmZip,
    shell,
    configStore,
    steamService,
    authSession,
    catalogStore: premiumCatalogStore,
    catalogClient: createPremiumCatalogClient({ axios }),
    downloadManager
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
    libraryService,
    catalogService: libraryCatalogService,
    manifestOverrideService
});

const dllInstaller = createDllInstaller({
    fs,
    path,
    dialog,
    requiredFiles: REQUIRED_STEAM_FILES,
    getSourcePath: getBundledSteamRuntimePath,
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
registerCorrectionsIpc({ ipcMain, correctionsService });
registerPremiumIpc({ ipcMain, premiumService });
registerAuthIpc({ ipcMain, authSession });
ipcMain.handle('app:set-menu-language', (_event, language) => {
    setApplicationMenu(language);
    return { success: true };
});
ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('app:check-for-updates', () => updateService.check());
ipcMain.handle('app:open-update-download', (_event, downloadUrl) => updateService.openDownload(downloadUrl));
ipcMain.handle('app:download-update', (event, payload) => updateService.downloadUpdate({
    ...payload,
    onProgress: progress => {
        if (!event.sender.isDestroyed()) {
            event.sender.send('app:update-download-progress', progress);
        }
    }
}));
ipcMain.handle('app:cancel-update-download', (_event, operationId) => updateService.cancelDownload(operationId));
ipcMain.handle('app:open-downloaded-update', (_event, filePath) => updateService.openDownloadedFile(filePath));
ipcMain.handle('app:open-downloaded-update-folder', (_event, folderPath) => updateService.openDownloadedFolder(folderPath));

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

