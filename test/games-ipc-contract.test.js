const test = require('node:test');
const assert = require('node:assert/strict');

const { registerGamesIpc } = require('../src/main/ipc/register-games-ipc');

test('registers isolated games IPC channels', () => {
    const channels = [];
    registerGamesIpc({
        ipcMain: { handle: channel => channels.push(channel) },
        addGamesService: {}
    });

    assert.deepEqual(channels, [
        'games:resolve-link',
        'games:search',
        'games:queue:list',
        'games:queue:add',
        'games:queue:remove',
        'games:queue:clear',
        'games:install-now',
        'games:install-all',
        'games:restart-steam'
    ]);
});
