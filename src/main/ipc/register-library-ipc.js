function registerLibraryIpc({ ipcMain, libraryService }) {
    ipcMain.handle('library:list', async () => libraryService.list());

    ipcMain.handle('library:refresh', async event => {
        event.sender.send('library:operation-progress', { operation: 'refresh', active: true });
        try {
            const result = await libraryService.list({ force: true });
            if (result.success) event.sender.send('library:updated', result.items);
            return result;
        } finally {
            event.sender.send('library:operation-progress', { operation: 'refresh', active: false });
        }
    });

    ipcMain.handle('library:remove', async (event, appId) => {
        event.sender.send('library:operation-progress', { operation: 'remove', active: true });
        try {
            const result = await libraryService.remove(appId);
            if (result.success) {
                const refreshed = await libraryService.list();
                if (refreshed.success) {
                    event.sender.send('library:updated', refreshed.items);
                    return { ...result, items: refreshed.items };
                }
            }
            return result;
        } finally {
            event.sender.send('library:operation-progress', { operation: 'remove', active: false });
        }
    });

    ipcMain.handle('library:restart-steam', async () => libraryService.restartSteam());
}

module.exports = { registerLibraryIpc };
