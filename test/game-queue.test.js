const test = require('node:test');
const assert = require('node:assert/strict');

const { createGameQueue } = require('../src/main/games/game-queue');

test('keeps unique games in memory and blocks external changes while locked', () => {
    const queue = createGameQueue();
    assert.equal(queue.add({ appId: '570', name: 'Dota 2' }).success, true);
    assert.equal(queue.add({ appId: '570', name: 'Another name' }).code, 'duplicate');
    queue.setLocked(true);
    assert.equal(queue.remove('570').code, 'queue_locked');
    assert.equal(queue.remove('570', true).success, true);
    assert.deepEqual(queue.list(), []);
});
