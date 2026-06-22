const DEFAULT_GAMES_CATALOG_URL = 'https://generator.ryuu.lol/files/games.json';
const RYUU_IMAGE_URL_TEMPLATE = 'https://generator.ryuu.lol/files/images/{appid}.jpg';

function normalizeRemoteGame(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const appId = String(entry.appid || '').trim();
    if (!/^\d+$/.test(appId)) return null;
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    const capsuleImage = typeof entry.capsule_image === 'string' ? entry.capsule_image.trim() : '';
    const headerImage = typeof entry.header_image === 'string' ? entry.header_image.trim() : '';
    const fallbackImage = RYUU_IMAGE_URL_TEMPLATE.replace('{appid}', appId);
    const coverUrl = capsuleImage || headerImage || fallbackImage;
    const coverSource = capsuleImage
        ? 'capsule_image'
        : headerImage
            ? 'header_image'
            : 'ryuu_image';

    return {
        appId,
        name,
        coverUrl,
        coverSource
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

function fallbackCoverForAppId(appId) {
    appId = String(appId || '').trim();
    return /^\d+$/.test(appId)
        ? RYUU_IMAGE_URL_TEMPLATE.replace('{appid}', appId)
        : null;
}

module.exports = {
    DEFAULT_GAMES_CATALOG_URL,
    RYUU_IMAGE_URL_TEMPLATE,
    createLibraryCatalogClient,
    fallbackCoverForAppId
};
