const test = require('node:test');
const assert = require('node:assert/strict');

const { registerLibraryIpc } = require('../src/main/ipc/register-library-ipc');

test('registers isolated Library IPC channels', () => {
    const channels = [];
    registerLibraryIpc({
        ipcMain: { handle: channel => channels.push(channel) },
        libraryService: {}
    });

    assert.deepEqual(channels, [
        'library:list',
        'library:refresh',
        'library:remove',
        'library:restart-steam'
    ]);
});
