const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path').win32;

const { createSteamService } = require('../src/main/steam/steam-service');

function createService(existingPaths) {
    const fs = {
        existsSync: filePath => existingPaths.has(path.normalize(filePath)),
        statSync: () => ({ isDirectory: () => true })
    };
    return createSteamService({
        fs,
        path,
        exec: () => {},
        platform: 'win32',
        userProfile: 'C:\\Users\\Test'
    });
}

test('reports a valid Steam installation only when exe and DLLs exist', () => {
    const root = path.normalize('C:\\Steam');
    const service = createService(new Set([
        root,
        path.join(root, 'steam.exe'),
        path.join(root, 'LumaCore.dll'),
        path.join(root, 'dwmapi.dll')
    ]));

    assert.deepEqual(service.getActivationReadiness(root), {
        ok: true,
        reason: null,
        missing: []
    });
});

test('reports missing LumaCore files without changing the path', () => {
    const root = path.normalize('C:\\Steam');
    const service = createService(new Set([root, path.join(root, 'steam.exe')]));
    const result = service.getActivationReadiness(root);

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'required_files_missing');
    assert.deepEqual(result.missing, ['LumaCore.dll', 'dwmapi.dll']);
});
