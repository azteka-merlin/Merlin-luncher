const DEFAULT_GAMES_CATALOG_URL = 'https://generator.ryuu.lol/files/games.json';

function normalizeRemoteGame(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const appId = String(entry.appid || '').trim();
    if (!/^\d+$/.test(appId)) return null;
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    const headerImage = typeof entry.header_image === 'string' ? entry.header_image.trim() : '';
    return {
        appId,
        name,
        coverUrl: headerImage || null,
        coverSource: headerImage ? 'header_image' : null
    };
}

function createLibraryCatalogClient({ axios, url = DEFAULT_GAMES_CATALOG_URL, timeout = 20000 }) {
    async function download() {
        const response = await axios.get(url, { timeout });
        if (!Array.isArray(response.data)) {
            throw new Error('Invalid games catalog payload');
        }
        const games = {};
        for (const entry of response.data) {
            const normalized = normalizeRemoteGame(entry);
            if (!normalized) continue;
            games[normalized.appId] = {
                name: normalized.name,
                coverUrl: normalized.coverUrl,
                coverSource: normalized.coverSource
            };
        }
        return {
            games,
            syncedAt: new Date().toISOString()
        };
    }

    return { download };
}

module.exports = { DEFAULT_GAMES_CATALOG_URL, createLibraryCatalogClient };
