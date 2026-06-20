const test = require('node:test');
const assert = require('node:assert/strict');

const { createGameNameResolver } = require('../src/main/games/game-name-resolver');

test('serializes Steam name requests and caches successful names', async () => {
    let active = 0;
    let maximumActive = 0;
    let calls = 0;
    const axios = {
        get: async (_url, options) => {
            calls++;
            active++;
            maximumActive = Math.max(maximumActive, active);
            await new Promise(resolve => setTimeout(resolve, 5));
            active--;
            const appId = options.params.appids;
            return { data: { [appId]: { success: true, data: { name: `Official ${appId}` } } } };
        }
    };
    const resolver = createGameNameResolver({ axios });

    const names = await Promise.all([
        resolver.resolve('1', 'Fallback 1'),
        resolver.resolve('2', 'Fallback 2')
    ]);
    const cached = await resolver.resolve('1', 'Different fallback');

    assert.deepEqual(names, ['Official 1', 'Official 2']);
    assert.equal(cached, 'Official 1');
    assert.equal(maximumActive, 1);
    assert.equal(calls, 2);
});

test('caches the link name when Steam name resolution fails', async () => {
    let calls = 0;
    const resolver = createGameNameResolver({
        axios: { get: async () => { calls++; throw new Error('rate limited'); } }
    });

    assert.equal(await resolver.resolve('3', 'Dead Space'), 'Dead Space');
    assert.equal(await resolver.resolve('3', 'Another fallback'), 'Dead Space');
    assert.equal(calls, 1);
});
