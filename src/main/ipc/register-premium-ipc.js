function registerPremiumIpc({ ipcMain, premiumService }) {
    ipcMain.handle('premium:list', async (_event, payload) =>
        premiumService.list({ force: payload?.force === true }));
    ipcMain.handle('premium:refresh', async () => premiumService.refresh());
    ipcMain.handle('premium:activate', async (event, payload) =>
        premiumService.activate(
            payload?.appId,
            payload?.operationId,
            data => event.sender.send('premium:progress', data)
        ));
    ipcMain.handle('premium:cancel', async (_event, operationId) =>
        premiumService.cancel(operationId));
    ipcMain.handle('premium:open-game-folder', async (_event, appId) =>
        premiumService.openGameFolder(appId));
}

module.exports = { registerPremiumIpc };
