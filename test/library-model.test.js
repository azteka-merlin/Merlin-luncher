const test = require('node:test');
const assert = require('node:assert/strict');

const { filterItems, paginate } = require('../src/renderer/library/library-model');

const items = [
    { appId: '413150', gameName: 'Stardew Valley' },
    { appId: '1145360', gameName: 'Hades' },
    { appId: '105600', gameName: 'Terraria' }
];

test('filters Library items by name and AppID', () => {
    assert.deepEqual(filterItems(items, 'STAR').map(item => item.appId), ['413150']);
    assert.deepEqual(filterItems(items, '105600').map(item => item.gameName), ['Terraria']);
});

test('paginates and corrects a page that no longer exists', () => {
    const manyItems = Array.from({ length: 24 }, (_, index) => ({ appId: String(index) }));
    assert.equal(paginate(manyItems, 2, 10).visible.length, 10);
    const corrected = paginate(manyItems.slice(0, 4), 3, 10);
    assert.equal(corrected.currentPage, 1);
    assert.equal(corrected.totalPages, 1);
    assert.equal(corrected.visible.length, 4);
});
