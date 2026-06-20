const test = require('node:test');
const assert = require('node:assert/strict');

const { extractManifestReferences } = require('../src/main/library/manifest-references');

test('extracts active and commented manifest references case-insensitively', () => {
    const references = extractManifestReferences([
        'setmanifestid(100, "200")',
        '--setManifestId(300,"400")',
        '  -- setmanifestid ( 500, 600 )',
        'addappid(700)',
        '--setmanifestid(100, "200")'
    ].join('\n'));

    assert.deepEqual(references, [
        { depotId: '100', manifestId: '200' },
        { depotId: '300', manifestId: '400' },
        { depotId: '500', manifestId: '600' }
    ]);
});
