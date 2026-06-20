const MESSAGES = {
    invalid_link: 'Cole um link válido da página do jogo na Steam.',
    invalid_domain: 'O link deve ser da loja oficial da Steam.',
    missing_name: 'O link precisa incluir o nome do jogo. Copie o endereço completo da página da Steam.'
};

class SteamLinkError extends Error {
    constructor(code) {
        super(MESSAGES[code] || MESSAGES.invalid_link);
        this.code = code;
    }
}

function parseSteamGameLink(link) {
    let url;
    try {
        url = new URL(String(link || '').trim());
    } catch (_) {
        throw new SteamLinkError('invalid_link');
    }

    if (url.hostname.toLowerCase() !== 'store.steampowered.com') {
        throw new SteamLinkError('invalid_domain');
    }

    const segments = url.pathname.split('/').filter(Boolean);
    if (segments[0]?.toLowerCase() !== 'app' || !/^\d+$/.test(segments[1] || '')) {
        throw new SteamLinkError('invalid_link');
    }
    if (!segments[2]) {
        throw new SteamLinkError('missing_name');
    }

    let decodedSlug;
    try {
        decodedSlug = decodeURIComponent(segments[2]);
    } catch (_) {
        throw new SteamLinkError('invalid_link');
    }

    const fallbackName = decodedSlug.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    if (!fallbackName) throw new SteamLinkError('missing_name');

    return {
        appId: segments[1],
        fallbackName,
        gameSlug: segments[2]
    };
}

module.exports = { SteamLinkError, parseSteamGameLink };
