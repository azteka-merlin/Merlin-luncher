function createLibraryNameStore({ fs, path, getFilePath }) {
    let loaded = false;
    let names = {};

    function load() {
        if (loaded) return names;
        loaded = true;
        try {
            const filePath = getFilePath();
            if (!fs.existsSync(filePath)) return names;
            const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const storedNames = payload?.names || payload;
            if (storedNames && typeof storedNames === 'object' && !Array.isArray(storedNames)) {
                names = Object.fromEntries(
                    Object.entries(storedNames)
                        .filter(([appId, name]) => /^\d+$/.test(appId)
                            && typeof name === 'string'
                            && name.trim())
                        .map(([appId, name]) => [appId, name.trim()])
                );
            }
        } catch (error) {
            console.warn('Unable to load Library name cache:', error.message);
        }
        return names;
    }

    function save() {
        const filePath = getFilePath();
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify({ version: 1, names }, null, 2), 'utf8');
    }

    function get(appId) {
        return load()[appId] || null;
    }

    function set(appId, name) {
        const normalizedName = typeof name === 'string' ? name.trim() : '';
        if (!/^\d+$/.test(String(appId)) || !normalizedName) return false;
        load();
        if (names[appId] === normalizedName) return false;
        names[appId] = normalizedName;
        save();
        return true;
    }

    function setMany(entries) {
        load();
        let changed = false;
        for (const [appId, name] of Object.entries(entries)) {
            const normalizedName = typeof name === 'string' ? name.trim() : '';
            if (!/^\d+$/.test(appId) || !normalizedName || names[appId] === normalizedName) {
                continue;
            }
            names[appId] = normalizedName;
            changed = true;
        }
        if (changed) save();
        return changed;
    }

    return { get, load, set, setMany };
}

module.exports = { createLibraryNameStore };
