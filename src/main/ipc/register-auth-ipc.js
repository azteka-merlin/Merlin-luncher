function getSignupUrl(apiBaseUrl) {
    try {
        const url = new URL(String(apiBaseUrl || ''));
        return url.origin + '/download';
    } catch (_) {
        return 'https://api-merlin.com/download';
    }
}

function registerAuthIpc({ ipcMain, authSession, shell, apiBaseUrl }) {
    ipcMain.handle('auth:has-session', () => authSession.hasStoredSession());
    ipcMain.handle('auth:status', async () => authSession.status());
    ipcMain.handle('auth:login', async (_event, licenseKey) => authSession.login(licenseKey));
    ipcMain.handle('auth:logout', () => authSession.logout());
    ipcMain.handle('auth:manage-subscription', async () => {
        const result = await authSession.createBillingPortalSession();
        if (!result.ok || !result.portalUrl) return result;
        await shell.openExternal(result.portalUrl);
        return { ok: true };
    });
    ipcMain.handle('auth:open-signup', async () => {
        const url = getSignupUrl(apiBaseUrl);
        await shell.openExternal(url);
        return { ok: true, url };
    });
}

module.exports = { getSignupUrl, registerAuthIpc };
