const test = require('node:test');
const assert = require('node:assert/strict');

const { createAddGamesService } = require('../src/main/games/add-games-service');
const { createGameQueue } = require('../src/main/games/game-queue');

test('installs queued games sequentially, removing successes and retaining failures', async () => {
    let active = 0;
    let maximumActive = 0;
    const gameInstaller = {
        install: async ({ appId, onProgress }) => {
            active++;
            maximumActive = Math.max(maximumActive, active);
            onProgress({ message: 'Installing', percent: 50 });
            await new Promise(resolve => setTimeout(resolve, 5));
            active--;
            return appId === '2'
                ? { success: false, message: 'Unavailable' }
                : { success: true, message: 'Installed' };
        }
    };
    const queue = createGameQueue();
    const service = createAddGamesService({
        parseSteamGameLink: link => ({ appId: link, fallbackName: `Game ${link}` }),
        nameResolver: { resolve: async (_appId, fallback) => fallback },
        queue,
        gameInstaller,
        configStore: { get: () => ({ steamPath: 'C:\\Steam' }) },
        steamService: {}
    });

    await service.add('1');
    await service.add('2');
    await service.add('3');
    const progress = [];
    const result = await service.installAll({ progress: item => progress.push(item) });

    assert.equal(maximumActive, 1);
    assert.deepEqual(result.installed.map(item => item.appId), ['1', '3']);
    assert.deepEqual(result.failed.map(item => item.appId), ['2']);
    assert.deepEqual(service.queueState().items.map(item => item.appId), ['2']);
    assert.deepEqual(progress.map(item => item.current), [1, 2, 3]);
});

test('blocks install now while the queue contains any game', async () => {
    const queue = createGameQueue();
    const service = createAddGamesService({
        parseSteamGameLink: link => ({ appId: link, fallbackName: `Game ${link}` }),
        nameResolver: { resolve: async (_appId, fallback) => fallback },
        queue,
        gameInstaller: { install: async () => ({ success: true }) },
        configStore: { get: () => ({ steamPath: 'C:\\Steam' }) },
        steamService: {}
    });

    await service.add('1');
    const result = await service.installNow('2');

    assert.equal(result.success, false);
    assert.equal(result.code, 'queue_not_empty');
});
