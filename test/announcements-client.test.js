const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeAnnouncement } = require('../src/main/announcements/announcements-client');

test('normalizes eligible announcement payloads', () => {
    const announcement = normalizeAnnouncement({
        id: 12,
        title: ' Aviso ',
        bodyText: ' Texto ',
        imageUrl: '/api/announcements/12/image',
        imageFit: 'contain',
        imagePositionX: '42',
        imagePositionY: 8,
        imageCropX: 12.5,
        imageCropY: '3.25',
        imageCropWidth: 70,
        imageCropHeight: 40,
        frequency: 'once_per_day',
        allowDismissForever: true
    }, 'https://staging.api-merlin.com/api/announcements');

    assert.deepEqual(announcement, {
        id: 12,
        title: 'Aviso',
        bodyText: 'Texto',
        imageUrl: 'https://staging.api-merlin.com/api/announcements/12/image',
        imageFit: 'contain',
        imagePositionX: 42,
        imagePositionY: 8,
        imageCropArea: {
            x: 12.5,
            y: 3.25,
            width: 70,
            height: 40
        },
        frequency: 'once_per_day',
        allowDismissForever: true
    });
});

test('defaults announcement image framing', () => {
    const announcement = normalizeAnnouncement({
        id: 13,
        title: 'Aviso',
        bodyText: 'Texto',
        imageFit: 'stretch',
        imagePositionX: -20,
        imagePositionY: 999
    });

    assert.equal(announcement.imageFit, 'cover');
    assert.equal(announcement.imagePositionX, 0);
    assert.equal(announcement.imagePositionY, 100);
    assert.equal(announcement.imageCropArea, null);
});

test('rejects invalid announcement crop areas', () => {
    const announcement = normalizeAnnouncement({
        id: 14,
        title: 'Aviso',
        bodyText: 'Texto',
        imageCropX: 80,
        imageCropY: 0,
        imageCropWidth: 30,
        imageCropHeight: 40
    });

    assert.equal(announcement.imageCropArea, null);
});

test('rejects incomplete announcements', () => {
    assert.equal(normalizeAnnouncement({ id: 1, title: 'Sem texto' }), null);
});
