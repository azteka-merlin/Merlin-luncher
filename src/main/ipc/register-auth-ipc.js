function registerAuthIpc({ ipcMain, authSession }) {
    ipcMain.handle('auth:has-session', () => authSession.hasStoredSession());
    ipcMain.handle('auth:status', async () => authSession.status());
    ipcMain.handle('auth:login', async (_event, licenseKey) => authSession.login(licenseKey));
}

module.exports = { registerAuthIpc };
