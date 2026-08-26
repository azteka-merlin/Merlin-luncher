function getSignupUrl(apiBaseUrl) {
    try {
        const url = new URL(String(apiBaseUrl || ''));
        return url.origin + '/download';
    } catch (_) {
        return 'https://api-merlin.com/download';
    }
}

function getPlansUrl(apiBaseUrl) {
    return `${getSignupUrl(apiBaseUrl)}?focus=planos#planos`;
}

function registerAuthIpc({ ipcMain, authSession, shell, apiBaseUrl, onLogout }) {
    ipcMain.handle('auth:has-session', () => authSession.hasStoredSession());
    ipcMain.handle('auth:status', async () => authSession.status());
    ipcMain.handle('auth:login', async (_event, licenseKey) => authSession.login(licenseKey));
    ipcMain.handle('auth:logout', () => {
        const result = authSession.logout();
        onLogout?.();
        return result;
    });
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
    ipcMain.handle('auth:open-plans', async () => {
        const url = getPlansUrl(apiBaseUrl);
        await shell.openExternal(url);
        return { ok: true, url };
    });
}

module.exports = { getPlansUrl, getSignupUrl, registerAuthIpc };
