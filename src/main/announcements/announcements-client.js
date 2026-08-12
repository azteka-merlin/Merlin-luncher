const DEFAULT_ANNOUNCEMENTS_URL = 'https://api-merlin.com/api/announcements';

function normalizeAnnouncement(entry, baseUrl = DEFAULT_ANNOUNCEMENTS_URL) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const id = Number(entry.id);
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    const bodyText = typeof entry.bodyText === 'string' ? entry.bodyText.trim() : '';
    if (!Number.isInteger(id) || id <= 0 || !title || !bodyText) return null;

    let imageUrl = typeof entry.imageUrl === 'string' ? entry.imageUrl.trim() : '';
    if (imageUrl && imageUrl.startsWith('/')) {
        imageUrl = new URL(imageUrl, baseUrl).toString();
    }

    const frequency = ['always', 'once_per_day', 'once'].includes(entry.frequency)
        ? entry.frequency
        : 'always';
    const imageFit = entry.imageFit === 'contain' ? 'contain' : 'cover';
    const normalizePosition = (value) => {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) return 50;
        return Math.min(100, Math.max(0, Math.round(numberValue)));
    };
    const normalizeCropArea = (value) => {
        const x = Number(value?.imageCropX);
        const y = Number(value?.imageCropY);
        const width = Number(value?.imageCropWidth);
        const height = Number(value?.imageCropHeight);
        if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
        if (x < 0 || y < 0 || x + width > 100 || y + height > 100) return null;
        return { x, y, width, height };
    };

    return {
        id,
        title,
        bodyText,
        imageUrl: imageUrl || null,
        imageFit,
        imagePositionX: normalizePosition(entry.imagePositionX),
        imagePositionY: normalizePosition(entry.imagePositionY),
        imageCropArea: normalizeCropArea(entry),
        frequency,
        allowDismissForever: entry.allowDismissForever === true
    };
}

function createAnnouncementsClient({
    axios,
    baseUrl = DEFAULT_ANNOUNCEMENTS_URL,
    timeout = 12000
}) {
    async function eligible(accessToken) {
        const response = await axios.get(`${baseUrl}/eligible`, {
            timeout,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json'
            }
        });

        return normalizeAnnouncement(response.data?.announcement, baseUrl);
    }

    async function recordView({ announcementId, accessToken }) {
        await axios.post(`${baseUrl}/${encodeURIComponent(String(announcementId))}/view`, {}, {
            timeout,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
                'Content-Type': 'application/json'
            }
        });
        return { success: true };
    }

    async function dismiss({ announcementId, accessToken }) {
        await axios.post(`${baseUrl}/${encodeURIComponent(String(announcementId))}/dismiss`, {}, {
            timeout,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
                'Content-Type': 'application/json'
            }
        });
        return { success: true };
    }

    return {
        eligible,
        recordView,
        dismiss
    };
}

module.exports = {
    DEFAULT_ANNOUNCEMENTS_URL,
    createAnnouncementsClient,
    normalizeAnnouncement
};
