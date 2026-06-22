function normalizeItem(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const appId = String(value.appId || '').trim();
    const gameName = typeof value.gameName === 'string' ? value.gameName.trim() : '';
    const imageUrl = typeof value.imageUrl === 'string' ? value.imageUrl.trim() : '';
    const correction = value.correction && typeof value.correction === 'object'
        ? {
            href: typeof value.correction.href === 'string' ? value.correction.href.trim() : '',
            filename: typeof value.correction.filename === 'string' ? value.correction.filename.trim() : '',
            size: typeof value.correction.size === 'string' ? value.correction.size.trim() : ''
        }
        : null;

    if (!/^\d+$/.test(appId) || !gameName || !correction?.href || !correction.filename) {
        return null;
    }

    return {
        appId,
        gameName,
        imageUrl: imageUrl || null,
        correction: {
            href: correction.href,
            filename: correction.filename,
            size: correction.size || undefined
        }
    };
}

function createCorrectionsCatalogStore({ fs, path, getFilePath }) {
    let loaded = false;
    let items = [];
    let lastSync = null;
    let hadLoadError = false;

    function load() {
        if (loaded) return { items, lastSync, hadLoadError };
        loaded = true;

        try {
            const filePath = getFilePath();
            if (!fs.existsSync(filePath)) return { items, lastSync, hadLoadError };

            const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const storedItems = Array.isArray(payload?.items) ? payload.items : [];
            items = storedItems.map(normalizeItem).filter(Boolean);
            lastSync = typeof payload?.lastSync === 'string' ? payload.lastSync : null;
        } catch (error) {
            hadLoadError = true;
            console.warn('Unable to load corrections catalog cache:', error.message);
        }

        return { items, lastSync, hadLoadError };
    }

    function save() {
        const filePath = getFilePath();
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify({ version: 1, lastSync, items }, null, 2), 'utf8');
    }

    function replace(nextItems, syncedAt = new Date().toISOString()) {
        load();
        items = Array.isArray(nextItems)
            ? nextItems.map(normalizeItem).filter(Boolean)
            : [];
        lastSync = syncedAt;
        hadLoadError = false;
        save();
        return items;
    }

    function list() {
        return load().items.map(item => ({
            ...item,
            correction: { ...item.correction }
        }));
    }

    function find(appId) {
        appId = String(appId || '').trim();
        return list().find(item => item.appId === appId) || null;
    }

    function hasItems() {
        return load().items.length > 0;
    }

    return { find, hasItems, list, load, replace };
}

module.exports = { createCorrectionsCatalogStore };
