const test = require('node:test');
const assert = require('node:assert/strict');

const { registerCorrectionsIpc } = require('../src/main/ipc/register-corrections-ipc');

test('registers isolated corrections IPC channels', () => {
    const channels = [];
    registerCorrectionsIpc({
        ipcMain: { handle: channel => channels.push(channel) },
        correctionsService: {}
    });

    assert.deepEqual(channels, [
        'corrections:list',
        'corrections:refresh',
        'corrections:prepare-install',
        'corrections:download',
        'corrections:install',
        'corrections:cancel',
        'corrections:open-folder'
    ]);
});
