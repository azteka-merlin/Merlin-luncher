const DEFAULT_PREMIUM_CATALOG_URL = 'https://api-merlin.com/api/premium/catalog';

function normalizeCatalogGame(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;

    const appId = String(entry.appId || '').trim();
    const gameName = typeof entry.name === 'string' ? entry.name.trim() : '';
    const imageUrl = typeof entry.coverUrl === 'string' ? entry.coverUrl.trim() : '';
    const installSubpath = typeof entry.installSubpath === 'string'
        ? entry.installSubpath.trim()
        : '';
    const activationType = entry.activationType === 'third_party'
        ? 'third_party'
        : 'steam_ticket';
    const launchExecutablePath = typeof entry.launchExecutablePath === 'string'
        ? entry.launchExecutablePath.trim()
        : '';
    const activationLimit = Math.max(1, Math.trunc(Number(entry.activationLimit) || 0));
    const availability = entry.availability && typeof entry.availability === 'object'
        ? {
            activeCount: Math.max(0, Math.trunc(Number(entry.availability.activeCount) || 0)),
            reservedCount: Math.max(0, Math.trunc(Number(entry.availability.reservedCount) || 0)),
            occupiedSlots: Math.max(0, Math.trunc(Number(entry.availability.occupiedSlots) || 0)),
            availableSlots: Math.max(0, Math.trunc(Number(entry.availability.availableSlots) || 0)),
            nextSlotAt: typeof entry.availability.nextSlotAt === 'string'
                ? entry.availability.nextSlotAt.trim() || null
                : null,
            cooldownEntries: Array.isArray(entry.availability.cooldownEntries)
                ? entry.availability.cooldownEntries
                    .map(item => {
                        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
                        const availableAt = typeof item.availableAt === 'string'
                            ? item.availableAt.trim()
                            : '';
                        const kind = item.kind === 'reserved' ? 'reserved' : 'cooldown';
                        if (!availableAt) return null;
                        return { availableAt, kind };
                    })
                    .filter(Boolean)
                : []
        }
        : null;
    const viewer = entry.viewer && typeof entry.viewer === 'object'
        ? {
            status: ['available', 'cooldown', 'reserved', 'unavailable'].includes(entry.viewer.status)
                ? entry.viewer.status
                : 'unavailable',
            canActivate: entry.viewer.canActivate === true,
            cooldownUntil: typeof entry.viewer.cooldownUntil === 'string'
                ? entry.viewer.cooldownUntil.trim() || null
                : null,
            reservedUntil: typeof entry.viewer.reservedUntil === 'string'
                ? entry.viewer.reservedUntil.trim() || null
                : null,
            lastActivatedAt: typeof entry.viewer.lastActivatedAt === 'string'
                ? entry.viewer.lastActivatedAt.trim() || null
                : null
        }
        : null;

    if (!/^\d+$/.test(appId) || !gameName || !availability || !viewer) {
        return null;
    }

    return {
        appId,
        gameName,
        imageUrl: imageUrl || null,
        installSubpath: installSubpath || null,
        activationType,
        launchExecutablePath: launchExecutablePath || null,
        activationLimit,
        enabled: entry.enabled === true,
        archiveAvailable: entry.archiveAvailable === true,
        availability,
        viewer
    };
}

function createPremiumCatalogClient({
    axios,
    catalogUrl = DEFAULT_PREMIUM_CATALOG_URL,
    activateUrl = DEFAULT_PREMIUM_CATALOG_URL.replace(/\/catalog$/, '/activate'),
    activateThirdPartyUrl = activateUrl.replace(/\/activate$/, '/activate-third-party'),
    timeout = 20000
}) {
    async function requestCatalog(accessToken) {
        const response = await axios.get(catalogUrl, {
            timeout,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json'
            }
        });

        if (!response.data || !Array.isArray(response.data.games)) {
            throw new Error('Invalid premium catalog payload');
        }

        return {
            items: response.data.games
                .map(normalizeCatalogGame)
                .filter(Boolean),
            syncedAt: new Date().toISOString()
        };
    }

    async function activate({ appId, accessToken }) {
        return (await axios.post(
            activateUrl,
            { appId },
            {
                timeout: Math.max(timeout, 120000),
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        )).data;
    }

    async function activateThirdParty({ appId, tokenReq, accessToken }) {
        return (await axios.post(
            activateThirdPartyUrl,
            { appId, tokenReq },
            {
                timeout: Math.max(timeout, 120000),
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        )).data;
    }

    return {
        activate,
        activateThirdParty,
        requestCatalog
    };
}

module.exports = {
    DEFAULT_PREMIUM_CATALOG_URL,
    createPremiumCatalogClient
};
