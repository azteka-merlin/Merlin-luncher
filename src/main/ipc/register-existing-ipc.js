function registerExistingIpc({
    ipcMain,
    dialog,
    configStore,
    steamService,
    dllInstaller,
    gameInstaller,
    libraryService,
    getMainWindow
}) {
    ipcMain.handle('get-config', async () => configStore.get());

    ipcMain.handle('validate-activation', async () =>
        steamService.getActivationReadiness(configStore.get().steamPath));

    ipcMain.handle('find-steam', async () => steamService.findDefaultPath());

    ipcMain.handle('save-config', async (_event, newConfig) => {
        const previousSteamPath = configStore.get().steamPath;
        configStore.update(newConfig);
        if (newConfig.steamPath !== undefined && newConfig.steamPath !== previousSteamPath) {
            libraryService?.invalidate();
        }
        return { success: true };
    });

    ipcMain.handle('select-steam-path', async () => {
        const result = await dialog.showOpenDialog(getMainWindow(), {
            properties: ['openDirectory'],
            title: 'Select Steam installation folder'
        });
        if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
        return null;
    });

    ipcMain.handle('verify-files', async () => {
        const config = configStore.get();
        if (!config.steamPath) {
            return { installed: false, alreadyInstalled: false, cancelled: false };
        }
        const result = await dllInstaller.checkAndInstall(config.steamPath, config.language);
        libraryService?.invalidate();
        return result;
    });

    ipcMain.handle('detect-steam', async () => {
        const steamPath = steamService.findDefaultPath();
        if (!steamPath) return null;
        const installResult = await dllInstaller.checkAndInstall(
            steamPath,
            configStore.get().language
        );
        libraryService?.invalidate();
        return { steamPath, ...installResult };
    });

    ipcMain.handle('is-steam-running', async () => steamService.isRunning());
    ipcMain.handle('is-steam-detected', async () => {
        const readiness = steamService.getActivationReadiness(configStore.get().steamPath);
        return readiness.reason !== 'steam_path_missing' && readiness.reason !== 'steam_path_invalid';
    });

    ipcMain.handle('check-files-status', async () =>
        steamService.getFilesStatus(configStore.get().steamPath));

    ipcMain.handle('close-steam', async () =>
        steamService.close(configStore.get().steamPath));

    ipcMain.handle('start-steam', async () =>
        steamService.start(configStore.get().steamPath));

    ipcMain.handle('download-game', async (event, appId) =>
        gameInstaller.install({
            appId,
            steamPath: configStore.get().steamPath,
            onProgress: progress => event.sender.send('download-progress', progress)
        }));
}

module.exports = { registerExistingIpc };
