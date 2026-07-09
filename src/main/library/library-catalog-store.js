function normalizeCatalogEntry(appId, value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const name = typeof value.name === 'string' ? value.name.trim() : '';
    const coverUrl = typeof value.coverUrl === 'string' ? value.coverUrl.trim() : '';
    const coverSource = typeof value.coverSource === 'string' ? value.coverSource.trim() : '';
    const finalCoverUrl = coverSource === 'ryuu_image' ? '' : coverUrl;
    const finalCoverSource = coverSource === 'ryuu_image' ? '' : coverSource;
    if (!name && !finalCoverUrl) return null;
    return {
        name,
        coverUrl: finalCoverUrl || null,
        coverSource: finalCoverSource || null
    };
}

function createLibraryCatalogStore({ fs, path, getFilePath }) {
    let loaded = false;
    let games = {};
    let lastSync = null;
    let hadLoadError = false;

    function load() {
        if (loaded) {
            return { games, lastSync, hadLoadError };
        }
        loaded = true;
        try {
            const filePath = getFilePath();
            if (!fs.existsSync(filePath)) {
                return { games, lastSync, hadLoadError };
            }
            const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const storedGames = payload?.games || payload;
            if (storedGames && typeof storedGames === 'object' && !Array.isArray(storedGames)) {
                games = Object.fromEntries(
                    Object.entries(storedGames)
                        .filter(([appId]) => /^\d+$/.test(appId))
                        .map(([appId, value]) => [appId, normalizeCatalogEntry(appId, value)])
                        .filter(([, value]) => value)
                );
            }
            lastSync = typeof payload?.lastSync === 'string' ? payload.lastSync : null;
        } catch (error) {
            hadLoadError = true;
            console.warn('Unable to load Library catalog cache:', error.message);
        }
        return { games, lastSync, hadLoadError };
    }

    function save() {
        const filePath = getFilePath();
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify({ version: 1, lastSync, games }, null, 2), 'utf8');
    }

    function get(appId) {
        load();
        return games[String(appId || '')] || null;
    }

    function replace(entries, syncedAt = new Date().toISOString()) {
        load();
        games = Object.fromEntries(
            Object.entries(entries || {})
                .filter(([appId]) => /^\d+$/.test(appId))
                .map(([appId, value]) => [appId, normalizeCatalogEntry(appId, value)])
                .filter(([, value]) => value)
        );
        lastSync = syncedAt;
        hadLoadError = false;
        save();
        return games;
    }

    function upsert(appId, value, { syncTimestamp = false } = {}) {
        appId = String(appId || '').trim();
        if (!/^\d+$/.test(appId)) return false;
        load();

        const normalized = normalizeCatalogEntry(appId, value);
        if (!normalized) return false;

        const current = games[appId] || null;
        if (current
            && current.name === normalized.name
            && current.coverUrl === normalized.coverUrl
            && current.coverSource === normalized.coverSource) {
            return false;
        }

        games[appId] = normalized;
        if (syncTimestamp || !lastSync) {
            lastSync = new Date().toISOString();
        }
        hadLoadError = false;
        save();
        return true;
    }

    function upsertMany(entries, { syncTimestamp = false } = {}) {
        load();
        let changed = false;

        for (const [appId, value] of Object.entries(entries || {})) {
            const normalized = normalizeCatalogEntry(appId, value);
            if (!normalized) continue;

            const current = games[appId] || null;
            if (current
                && current.name === normalized.name
                && current.coverUrl === normalized.coverUrl
                && current.coverSource === normalized.coverSource) {
                continue;
            }

            games[appId] = normalized;
            changed = true;
        }

        if (!changed) return false;
        if (syncTimestamp || !lastSync) {
            lastSync = new Date().toISOString();
        }
        hadLoadError = false;
        save();
        return true;
    }

    function needsBootstrap() {
        const state = load();
        return state.hadLoadError || Object.keys(state.games).length === 0;
    }

    return { get, load, needsBootstrap, replace, upsert, upsertMany };
}

module.exports = { createLibraryCatalogStore };
