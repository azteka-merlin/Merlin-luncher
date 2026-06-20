const test = require('node:test');
const assert = require('node:assert/strict');

const { parseSteamGameLink } = require('../src/main/games/steam-link-parser');

test('extracts AppID only from the segment after app', () => {
    const result = parseSteamGameLink(
        'https://store.steampowered.com/app/1693980/Dead_Space_2/?snr=12345#agecheck'
    );
    assert.deepEqual(result, {
        appId: '1693980',
        fallbackName: 'Dead Space 2',
        gameSlug: 'Dead_Space_2'
    });
});

test('rejects links without a game name', () => {
    assert.throws(
        () => parseSteamGameLink('https://store.steampowered.com/app/1693980'),
        error => error.code === 'missing_name'
    );
});

test('rejects non-Steam Store domains', () => {
    assert.throws(
        () => parseSteamGameLink('https://steamdb.info/app/1693980/Dead_Space/'),
        error => error.code === 'invalid_domain'
    );
});
