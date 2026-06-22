const test = require('node:test');
const assert = require('node:assert/strict');

const { transformLuaContent } = require('../src/main/files/lua-transformer');

test('comments every active line containing setmanifestid', () => {
    const source = [
        'addappid(1805110)',
        'setmanifestid(1)',
        '  if ready then setManifestId (2) end',
        '--setManifestid(3)',
        '  -- setmanifestid(4)',
        'print("ok")'
    ].join('\n');

    const result = transformLuaContent(source);

    assert.equal(result.commentedLines, 2);
    assert.match(result.content, /^--setmanifestid\(1\)$/m);
    assert.match(result.content, /^  --if ready then setManifestId \(2\) end$/m);
    assert.match(result.content, /^--setManifestid\(3\)$/m);
    assert.doesNotMatch(result.content, /----setManifestid/);
    assert.match(result.content, /^addappid\(1805110\)$/m);
});

test('preserves setmanifestid lines when automatic updates are disabled', () => {
    const source = [
        'addappid(1805110)',
        'setmanifestid(1)',
        '  if ready then setManifestId (2) end'
    ].join('\n');

    const result = transformLuaContent(source, { autoUpdate: false });

    assert.equal(result.commentedLines, 0);
    assert.equal(result.content, source);
});
