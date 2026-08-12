function registerAnnouncementsIpc({ ipcMain, announcementsService }) {
    ipcMain.handle('announcements:eligible', async () => announcementsService.eligible());
    ipcMain.handle('announcements:view', async (_event, payload) => announcementsService.recordView(payload));
    ipcMain.handle('announcements:dismiss', async (_event, payload) => announcementsService.dismiss(payload));
}

module.exports = { registerAnnouncementsIpc };
