function registerPollsIpc({ ipcMain, pollsService }) {
    ipcMain.handle('polls:active', async () => pollsService.active());
    ipcMain.handle('polls:vote', async (_event, payload) => pollsService.vote(payload));
}

module.exports = { registerPollsIpc };
