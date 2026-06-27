function registerCorrectionsIpc({ ipcMain, correctionsService }) {
    ipcMain.handle('corrections:list', async () => correctionsService.list());
    ipcMain.handle('corrections:refresh', async () => correctionsService.refresh());
    ipcMain.handle('corrections:prepare-install', async (_event, appId) =>
        correctionsService.prepareInstall(appId));
    ipcMain.handle('corrections:vote', async (_event, payload) =>
        correctionsService.vote(payload?.appId, payload?.vote));
    ipcMain.handle('corrections:download', async (event, payload) =>
        correctionsService.download(
            payload?.appId,
            payload?.operationId,
            data => event.sender.send('corrections:progress', data)
        ));
    ipcMain.handle('corrections:install', async (event, payload) =>
        correctionsService.install(
            payload?.appId,
            payload?.operationId,
            data => event.sender.send('corrections:progress', data)
        ));
    ipcMain.handle('corrections:cancel', async (_event, operationId) =>
        correctionsService.cancel(operationId));
    ipcMain.handle('corrections:open-folder', async (_event, folderPath) =>
        correctionsService.openFolder(folderPath));
}

module.exports = { registerCorrectionsIpc };
