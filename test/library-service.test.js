const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createLibraryService } = require('../src/main/library/library-service');

function createFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'merlin-library-'));
    const luaDirectory = path.join(root, 'config', 'stplug-in');
    const manifestDirectory = path.join(root, 'depotcache');
    fs.mkdirSync(luaDirectory, { recursive: true });
    fs.mkdirSync(manifestDirectory, { recursive: true });
    fs.writeFileSync(path.join(root, 'steam.exe'), '');
    const names = {};
    const nameStore = {
        get: appId => names[appId] || null,
        set: (appId, name) => { names[appId] = name; },
        setMany: entries => Object.assign(names, entries)
    };
    return { root, luaDirectory, manifestDirectory, names, nameStore };
}

function serviceFor(fixture, resolve) {
    return createLibraryService({
        fs,
        path,
        configStore: { get: () => ({ steamPath: fixture.root }) },
        nameStore: fixture.nameStore,
        nameResolver: { resolve },
        steamService: { isRunning: async () => true }
    });
}

test('resolves only unknown names and keeps resolved names across refreshes', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(fixture.luaDirectory, '1.lua'), 'addappid(1)');
    fs.writeFileSync(path.join(fixture.luaDirectory, '2.lua'), 'addappid(2)');
    fixture.names['1'] = 'Cached Game';
    const calls = [];
    const service = serviceFor(fixture, async appId => {
        calls.push(appId);
        return `Resolved ${appId}`;
    });

    const first = await service.list();
    const refreshed = await service.list({ force: true });

    assert.equal(first.success, true);
    assert.equal(refreshed.success, true);
    assert.deepEqual(calls, ['2']);
    assert.equal(fixture.names['2'], 'Resolved 2');
});

test('does not persist fallback names and retries unresolved AppIDs', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(fixture.luaDirectory, '3.lua'), 'addappid(3)');
    let calls = 0;
    const service = serviceFor(fixture, async () => { calls++; return null; });

    const first = await service.list();
    await service.list({ force: true });

    assert.equal(first.items[0].gameName, '');
    assert.equal(fixture.names['3'], undefined);
    assert.equal(calls, 2);
});

test('removes the Lua and exclusive manifests but preserves shared manifests', async t => {
    const fixture = createFixture();
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
    const targetLua = path.join(fixture.luaDirectory, '10.lua');
    const otherLua = path.join(fixture.luaDirectory, '20.lua');
    const exclusiveManifest = path.join(fixture.manifestDirectory, '100_1000.manifest');
    const sharedManifest = path.join(fixture.manifestDirectory, '200_2000.manifest');
    fs.writeFileSync(targetLua, '--setmanifestid(100,"1000")\n--setmanifestid(200,"2000")');
    fs.writeFileSync(otherLua, '--setmanifestid(200,"2000")');
    fs.writeFileSync(exclusiveManifest, 'exclusive');
    fs.writeFileSync(sharedManifest, 'shared');
    fixture.names['10'] = 'Remembered Game';
    const service = serviceFor(fixture, async appId => `Game ${appId}`);

    const result = await service.remove('10');

    assert.equal(result.success, true);
    assert.equal(result.removedManifests, 1);
    assert.equal(result.steamRunning, true);
    assert.equal(fs.existsSync(targetLua), false);
    assert.equal(fs.existsSync(exclusiveManifest), false);
    assert.equal(fs.existsSync(sharedManifest), true);
    assert.equal(fs.existsSync(otherLua), true);
    assert.equal(fixture.names['10'], 'Remembered Game');
});
