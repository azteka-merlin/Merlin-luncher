const { fallbackCoverForAppId } = require('./library-catalog-client');

function scoreMatch(game, normalizedQuery) {
    const name = String(game.name || '').toLocaleLowerCase();
    const appId = String(game.appId || '');
    if (!normalizedQuery) return -1;
    if (appId === normalizedQuery) return 4000;
    if (name.startsWith(normalizedQuery)) return 3000 - name.length;
    if (name.includes(normalizedQuery)) return 2000 - name.indexOf(normalizedQuery);
    if (/^\d+$/.test(normalizedQuery) && appId.startsWith(normalizedQuery)) return 1000 - appId.length;
    return -1;
}

function createLibraryCatalogService({ catalogStore, catalogClient }) {
    let refreshPromise = null;

    function normalizeEntry(appId, entry) {
        if (!entry) return null;
        const fallbackCoverUrl = fallbackCoverForAppId(appId);
        return {
            name: entry.name,
            coverUrl: entry.coverUrl || fallbackCoverUrl || null,
            coverSource: entry.coverSource || (entry.coverUrl ? null : fallbackCoverUrl ? 'ryuu_image' : null)
        };
    }

    async function refresh() {
        if (!refreshPromise) {
            refreshPromise = catalogClient.download()
                .then(downloaded => {
                    catalogStore.replace(downloaded.games, downloaded.syncedAt);
                    return downloaded.games;
                })
                .finally(() => {
                    refreshPromise = null;
                });
        }
        return refreshPromise;
    }

    async function ensureLoaded() {
        if (catalogStore.needsBootstrap()) {
            await refresh();
        } else {
            catalogStore.load();
        }
        return catalogStore.load().games;
    }

    function findByAppId(appId) {
        const entry = normalizeEntry(appId, catalogStore.get(appId));
        if (!entry) return null;
        return {
            appId: String(appId),
            name: entry.name,
            coverUrl: entry.coverUrl,
            coverSource: entry.coverSource
        };
    }

    function findMatches(games, normalizedQuery, limit) {
        const matches = [];

        for (const [appId, entry] of Object.entries(games)) {
            const game = { appId, ...normalizeEntry(appId, entry) };
            const score = scoreMatch(game, normalizedQuery);
            if (score < 0) continue;
            matches.push({ ...game, score });
        }

        return matches
            .sort((left, right) => right.score - left.score
                || left.name.localeCompare(right.name)
                || left.appId.localeCompare(right.appId))
            .slice(0, limit)
            .map(({ score, ...game }) => game);
    }

    async function resolveByAppId(appId, { allowRefresh = true } = {}) {
        appId = String(appId || '').trim();
        if (!/^\d+$/.test(appId)) return null;
        let match = findByAppId(appId);
        if (match || !allowRefresh) return match;
        await refresh();
        return findByAppId(appId);
    }

    async function search(query, { limit = 4 } = {}) {
        const normalizedQuery = String(query || '').trim().toLocaleLowerCase();
        if (!normalizedQuery) return [];
        const games = await ensureLoaded();
        let matches = findMatches(games, normalizedQuery, limit);
        if (matches.length > 0) return matches;

        await refresh();
        matches = findMatches(catalogStore.load().games, normalizedQuery, limit);
        return matches;
    }

    return { ensureLoaded, findByAppId, refresh, resolveByAppId, search };
}

module.exports = { createLibraryCatalogService };
