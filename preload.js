const { contextBridge, ipcRenderer } = require('electron');

// direct APIs to renderer in a secure way
contextBridge.exposeInMainWorld('electronAPI', {
    // settings
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    setMenuLanguage: (language) => ipcRenderer.invoke('app:set-menu-language', language),
    onOpenTutorial: (callback) => ipcRenderer.on('tutorial:open', callback),

    // Authentication
    auth: {
        hasSession: () => ipcRenderer.invoke('auth:has-session'),
        status: () => ipcRenderer.invoke('auth:status'),
        login: (licenseKey) => ipcRenderer.invoke('auth:login', licenseKey),
        onRequired: (callback) => ipcRenderer.on('auth:required', (_event, data) => callback(data))
    },

    // Steam management
    selectSteamPath: () => ipcRenderer.invoke('select-steam-path'),
    findSteam: () => ipcRenderer.invoke('find-steam'),
    detectSteam: () => ipcRenderer.invoke('detect-steam'),
    isSteamRunning: () => ipcRenderer.invoke('is-steam-running'),
    closeSteam: () => ipcRenderer.invoke('close-steam'),
    startSteam: () => ipcRenderer.invoke('start-steam'),

    // Download and installation
    downloadGame: (appId) => ipcRenderer.invoke('download-game', appId),
    validateActivation: () => ipcRenderer.invoke('validate-activation'),
    checkFilesStatus: () => ipcRenderer.invoke('check-files-status'),
    verifyFiles: () => ipcRenderer.invoke('verify-files'),

    // Events
    onDownloadProgress: (callback) => {
        ipcRenderer.on('download-progress', (event, data) => callback(data));
    },
    removeDownloadProgressListener: () => {
        ipcRenderer.removeAllListeners('download-progress');
    },
    onFilesStatus: (callback) => {
        ipcRenderer.on('files-status', (event, data) => callback(data));
    },

    // Isolated "Add games" feature
    games: {
        resolveLink: (link) => ipcRenderer.invoke('games:resolve-link', link),
        listQueue: () => ipcRenderer.invoke('games:queue:list'),
        addToQueue: (link) => ipcRenderer.invoke('games:queue:add', link),
        removeFromQueue: (appId) => ipcRenderer.invoke('games:queue:remove', appId),
        clearQueue: () => ipcRenderer.invoke('games:queue:clear'),
        installNow: (link) => ipcRenderer.invoke('games:install-now', link),
        installAll: () => ipcRenderer.invoke('games:install-all'),
        restartSteam: () => ipcRenderer.invoke('games:restart-steam'),
        onQueueUpdated: (callback) => {
            ipcRenderer.on('games:queue-updated', (_event, data) => callback(data));
        },
        onInstallProgress: (callback) => {
            ipcRenderer.on('games:install-progress', (_event, data) => callback(data));
        },
        onInstallComplete: (callback) => {
            ipcRenderer.on('games:install-complete', (_event, data) => callback(data));
        },
        removeListeners: () => {
            ipcRenderer.removeAllListeners('games:queue-updated');
            ipcRenderer.removeAllListeners('games:install-progress');
            ipcRenderer.removeAllListeners('games:install-complete');
        }
    },

    // Native Library feature
    library: {
        list: () => ipcRenderer.invoke('library:list'),
        refresh: () => ipcRenderer.invoke('library:refresh'),
        remove: (appId) => ipcRenderer.invoke('library:remove', appId),
        restartSteam: () => ipcRenderer.invoke('library:restart-steam'),
        onUpdated: (callback) => {
            ipcRenderer.on('library:updated', (_event, items) => callback(items));
        },
        onOperationProgress: (callback) => {
            ipcRenderer.on('library:operation-progress', (_event, state) => callback(state));
        },
        removeListeners: () => {
            ipcRenderer.removeAllListeners('library:updated');
            ipcRenderer.removeAllListeners('library:operation-progress');
        }
    }
});
