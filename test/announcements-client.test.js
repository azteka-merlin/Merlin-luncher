const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeAnnouncement } = require('../src/main/announcements/announcements-client');

test('normalizes eligible announcement payloads', () => {
    const announcement = normalizeAnnouncement({
        id: 12,
        title: ' Aviso ',
        bodyText: ' Texto ',
        imageUrl: '/api/announcements/12/image',
        frequency: 'once_per_day',
        allowDismissForever: true
    }, 'https://staging.api-merlin.com/api/announcements');

    assert.deepEqual(announcement, {
        id: 12,
        title: 'Aviso',
        bodyText: 'Texto',
        imageUrl: 'https://staging.api-merlin.com/api/announcements/12/image',
        frequency: 'once_per_day',
        allowDismissForever: true
    });
});

test('rejects incomplete announcements', () => {
    assert.equal(normalizeAnnouncement({ id: 1, title: 'Sem texto' }), null);
});
