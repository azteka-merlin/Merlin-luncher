const DEFAULT_CORRECTIONS_CATALOG_URL = 'https://generator.ryuu.lol/files/fixes.json';

function firstEligibleCorrection(fixes) {
    if (!Array.isArray(fixes)) return null;

    for (const fix of fixes) {
        if (!fix || typeof fix !== 'object' || Array.isArray(fix)) continue;
        const badges = Array.isArray(fix.badges)
            ? fix.badges.map(value => String(value || '').trim().toLocaleLowerCase())
            : [];
        if (badges.includes('hypervisor')) continue;

        const href = typeof fix.href === 'string' ? fix.href.trim() : '';
        const filename = typeof fix.filename === 'string' ? fix.filename.trim() : '';
        const size = typeof fix.size === 'string' ? fix.size.trim() : '';
        if (!href || !filename) continue;

        return {
            href,
            filename,
            size: size || undefined
        };
    }

    return null;
}

function normalizeRemoteGame(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const appId = String(entry.appid || '').trim();
    const gameName = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!/^\d+$/.test(appId) || !gameName) return null;

    const correction = firstEligibleCorrection(entry.fixes);
    if (!correction) return null;

    return {
        appId,
        gameName,
        correction
    };
}

function createCorrectionsCatalogClient({ axios, url = DEFAULT_CORRECTIONS_CATALOG_URL, timeout = 20000 }) {
    async function download() {
        const response = await axios.get(url, { timeout });
        if (!Array.isArray(response.data)) {
            throw new Error('Invalid corrections catalog payload');
        }

        return {
            items: response.data
                .map(normalizeRemoteGame)
                .filter(Boolean),
            syncedAt: new Date().toISOString()
        };
    }

    return { download };
}

module.exports = {
    DEFAULT_CORRECTIONS_CATALOG_URL,
    createCorrectionsCatalogClient
};
