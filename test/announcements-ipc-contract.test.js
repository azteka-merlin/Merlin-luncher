const test = require('node:test');
const assert = require('node:assert/strict');

const { registerAnnouncementsIpc } = require('../src/main/ipc/register-announcements-ipc');

test('registers isolated announcements IPC channels', () => {
    const channels = [];
    registerAnnouncementsIpc({
        ipcMain: { handle: channel => channels.push(channel) },
        announcementsService: {}
    });

    assert.deepEqual(channels, [
        'announcements:eligible',
        'announcements:view',
        'announcements:dismiss'
    ]);
});
