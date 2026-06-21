function normalizeEntry(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const name = typeof value.name === 'string' ? value.name.trim() : '';
    const coverUrl = typeof value.coverUrl === 'string' ? value.coverUrl.trim() : '';
    const coverSource = typeof value.coverSource === 'string' ? value.coverSource.trim() : '';
    return {
        name,
        coverUrl: coverUrl || null,
        coverSource: coverSource || null,
        notFoundInCatalog: Boolean(value.notFoundInCatalog)
    };
}

function createLibraryCacheStore({ fs, path, getFilePath, getLegacyFilePath }) {
    let loaded = false;
    let games = {};

    function migrateLegacyNames() {
        if (typeof getLegacyFilePath !== 'function') return;
        try {
            const legacyPath = getLegacyFilePath();
            if (!legacyPath || !fs.existsSync(legacyPath)) return;
            const payload = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
            const legacyNames = payload?.names || payload;
            if (!legacyNames || typeof legacyNames !== 'object' || Array.isArray(legacyNames)) return;
            for (const [appId, name] of Object.entries(legacyNames)) {
                const normalizedName = typeof name === 'string' ? name.trim() : '';
                if (!/^\d+$/.test(appId) || !normalizedName || games[appId]) continue;
                games[appId] = {
                    name: normalizedName,
                    coverUrl: null,
                    coverSource: null,
                    notFoundInCatalog: false
                };
            }
        } catch (error) {
            console.warn('Unable to migrate legacy Library cache:', error.message);
        }
    }

    function load() {
        if (loaded) return games;
        loaded = true;
        try {
            const filePath = getFilePath();
            if (fs.existsSync(filePath)) {
                const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const storedGames = payload?.games || payload;
                if (storedGames && typeof storedGames === 'object' && !Array.isArray(storedGames)) {
                    games = Object.fromEntries(
                        Object.entries(storedGames)
                            .filter(([appId]) => /^\d+$/.test(appId))
                            .map(([appId, value]) => [appId, normalizeEntry(value)])
                            .filter(([, value]) => value && (value.name || value.coverUrl || value.notFoundInCatalog))
                    );
                }
            } else {
                migrateLegacyNames();
            }
        } catch (error) {
            console.warn('Unable to load Library cache:', error.message);
            migrateLegacyNames();
        }
        return games;
    }

    function save() {
        const filePath = getFilePath();
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify({ version: 1, games }, null, 2), 'utf8');
    }

    function get(appId) {
        return load()[String(appId || '')] || null;
    }

    function hasCompleteMetadata(appId) {
        const entry = get(appId);
        return Boolean(entry && entry.name && (entry.coverUrl || entry.notFoundInCatalog));
    }

    function merge(appId, data) {
        appId = String(appId || '').trim();
        if (!/^\d+$/.test(appId) || !data || typeof data !== 'object') return false;
        load();
        const current = games[appId] || {
            name: '',
            coverUrl: null,
            coverSource: null,
            notFoundInCatalog: false
        };
        const next = {
            name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : current.name,
            coverUrl: Object.prototype.hasOwnProperty.call(data, 'coverUrl')
                ? (typeof data.coverUrl === 'string' && data.coverUrl.trim() ? data.coverUrl.trim() : null)
                : current.coverUrl,
            coverSource: Object.prototype.hasOwnProperty.call(data, 'coverSource')
                ? (typeof data.coverSource === 'string' && data.coverSource.trim() ? data.coverSource.trim() : null)
                : current.coverSource,
            notFoundInCatalog: Object.prototype.hasOwnProperty.call(data, 'notFoundInCatalog')
                ? Boolean(data.notFoundInCatalog)
                : current.notFoundInCatalog
        };

        if (current.name === next.name
            && current.coverUrl === next.coverUrl
            && current.coverSource === next.coverSource
            && current.notFoundInCatalog === next.notFoundInCatalog) {
            return false;
        }

        games[appId] = next;
        save();
        return true;
    }

    function mergeMany(entries) {
        load();
        let changed = false;
        for (const [appId, data] of Object.entries(entries || {})) {
            changed = merge(appId, data) || changed;
        }
        return changed;
    }

    return { get, hasCompleteMetadata, load, merge, mergeMany };
}

module.exports = { createLibraryCacheStore };
