const test = require('node:test');
const assert = require('node:assert/strict');

const { registerExistingIpc } = require('../src/main/ipc/register-existing-ipc');

test('preserves every existing IPC channel', () => {
    const channels = [];
    const ipcMain = { handle: channel => channels.push(channel) };
    const noop = () => {};

    registerExistingIpc({
        ipcMain,
        dialog: {},
        configStore: {},
        steamService: {},
        dllInstaller: {},
        gameInstaller: {},
        getMainWindow: noop
    });

    assert.deepEqual(channels, [
        'get-config',
        'validate-activation',
        'find-steam',
        'save-config',
        'select-steam-path',
        'verify-files',
        'detect-steam',
        'is-steam-running',
        'is-steam-detected',
        'check-files-status',
        'close-steam',
        'start-steam',
        'download-game'
    ]);
});
