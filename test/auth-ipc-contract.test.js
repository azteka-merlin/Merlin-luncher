const test = require('node:test');
const assert = require('node:assert/strict');

const { registerAuthIpc } = require('../src/main/ipc/register-auth-ipc');

test('registers auth IPC channels', () => {
    const channels = [];

    registerAuthIpc({
        ipcMain: { handle: channel => channels.push(channel) },
        authSession: {},
        shell: {},
        apiBaseUrl: 'https://api-merlin.com/api'
    });

    assert.deepEqual(channels, [
        'auth:has-session',
        'auth:status',
        'auth:login',
        'auth:logout',
        'auth:manage-subscription',
        'auth:open-signup'
    ]);
});
