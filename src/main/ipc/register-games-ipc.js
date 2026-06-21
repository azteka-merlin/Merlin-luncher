function registerGamesIpc({ ipcMain, addGamesService }) {
    const emit = (event, channel, data) => event.sender.send(channel, data);
    const eventsFor = event => ({
        progress: data => emit(event, 'games:install-progress', data),
        queueUpdated: data => emit(event, 'games:queue-updated', data)
    });

    ipcMain.handle('games:resolve-link', async (_event, link) =>
        addGamesService.resolveLink(link));

    ipcMain.handle('games:search', async (_event, query) =>
        addGamesService.searchCatalog(query));

    ipcMain.handle('games:queue:list', async () => addGamesService.queueState());

    ipcMain.handle('games:queue:add', async (event, link) =>
        addGamesService.add(link, data => emit(event, 'games:queue-updated', data)));

    ipcMain.handle('games:queue:remove', async (event, appId) =>
        addGamesService.remove(appId, data => emit(event, 'games:queue-updated', data)));

    ipcMain.handle('games:queue:clear', async event =>
        addGamesService.clear(data => emit(event, 'games:queue-updated', data)));

    ipcMain.handle('games:install-now', async (event, link) => {
        const result = await addGamesService.installNow(link, eventsFor(event));
        emit(event, 'games:install-complete', result);
        return result;
    });

    ipcMain.handle('games:install-all', async event => {
        const result = await addGamesService.installAll(eventsFor(event));
        emit(event, 'games:install-complete', result);
        return result;
    });

    ipcMain.handle('games:restart-steam', async () => addGamesService.restartSteam());
}

module.exports = { registerGamesIpc };
