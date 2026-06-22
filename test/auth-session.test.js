const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createAuthSession } = require('../src/main/auth/auth-session');

function createMemoryFs() {
    const files = new Map();

    return {
        existsSync(filePath) {
            return files.has(filePath);
        },
        readFileSync(filePath) {
            const value = files.get(filePath);
            if (value === undefined) throw new Error(`File not found: ${filePath}`);
            return value;
        },
        writeFileSync(filePath, contents) {
            files.set(filePath, String(contents));
        },
        mkdirSync() {},
        rmSync(filePath) {
            files.delete(filePath);
        }
    };
}

function createSafeStorage() {
    return {
        isEncryptionAvailable: () => true,
        encryptString: value => Buffer.from(value, 'utf8'),
        decryptString: buffer => Buffer.from(buffer).toString('utf8')
    };
}

test('auth session allows retry after transient server validation failure', async () => {
    let attempts = 0;
    const fs = createMemoryFs();
    const session = createAuthSession({
        app: { getPath: () => 'C:\\Users\\AZTEKA\\AppData\\Roaming\\Merlin' },
        safeStorage: createSafeStorage(),
        fs,
        path,
        axios: {
            post: async () => {
                attempts += 1;
                if (attempts === 1) {
                    const error = new Error('temporary failure');
                    error.response = { status: 500, data: { message: 'Database update failed' } };
                    throw error;
                }

                return {
                    data: {
                        accessToken: 'token-123',
                        expiresIn: 3600,
                        license: {
                            name: 'Azteka',
                            expiresAt: '2026-12-31',
                            status: 'active'
                        }
                    }
                };
            }
        },
        httpsAgent: {},
        machineIdentity: {
            getHwid: async () => 'merlin-hwid-123'
        },
        baseUrl: 'https://merlin-api.example.com'
    });

    const firstAttempt = await session.login('MERLIN-ABCD-EFGH-JKLM');
    assert.equal(firstAttempt.authenticated, false);
    assert.equal(firstAttempt.code, 'server_error');
    assert.equal(session.hasStoredSession(), false);

    const secondAttempt = await session.login('MERLIN-ABCD-EFGH-JKLM');
    assert.equal(secondAttempt.authenticated, true);
    assert.equal(secondAttempt.license.name, 'Azteka');
    assert.equal(session.hasStoredSession(), true);

    const accessToken = await session.getAccessToken();
    assert.equal(accessToken, 'token-123');
    assert.equal(attempts, 2);
});

test('auth session returns rate_limited when the API throttles license attempts', async () => {
    const session = createAuthSession({
        app: { getPath: () => 'C:\\Users\\AZTEKA\\AppData\\Roaming\\Merlin' },
        safeStorage: createSafeStorage(),
        fs: createMemoryFs(),
        path,
        axios: {
            post: async () => {
                const error = new Error('too many requests');
                error.response = {
                    status: 429,
                    data: 'O limite temporario de tentativas de acesso foi atingido.'
                };
                throw error;
            }
        },
        httpsAgent: {},
        machineIdentity: {
            getHwid: async () => 'merlin-hwid-123'
        },
        baseUrl: 'https://api-merlin.com/api'
    });

    const result = await session.login('MERLIN-ABCD-EFGH-JKLM');
    assert.equal(result.authenticated, false);
    assert.equal(result.code, 'rate_limited');
});
