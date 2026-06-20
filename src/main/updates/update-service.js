const RELEASE_API_URL = 'https://api.github.com/repos/azteka-merlin/Merlin-luncher/releases/latest';

function normalizeVersion(value) {
    return String(value || '').trim().replace(/^v/i, '').split('-')[0];
}

function compareVersions(left, right) {
    const a = normalizeVersion(left).split('.').map(part => Number.parseInt(part, 10) || 0);
    const b = normalizeVersion(right).split('.').map(part => Number.parseInt(part, 10) || 0);
    const length = Math.max(a.length, b.length);

    for (let index = 0; index < length; index += 1) {
        const difference = (a[index] || 0) - (b[index] || 0);
        if (difference !== 0) return Math.sign(difference);
    }
    return 0;
}

function isOfficialDownloadUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:'
            && url.hostname === 'github.com'
            && url.pathname.startsWith('/azteka-merlin/Merlin-luncher/releases/download/');
    } catch {
        return false;
    }
}

function createUpdateService({ app, axios, shell }) {
    async function check() {
        const currentVersion = app.getVersion();
        try {
            const response = await axios.get(RELEASE_API_URL, {
                timeout: 10000,
                headers: {
                    Accept: 'application/vnd.github+json',
                    'User-Agent': `Merlin/${currentVersion}`
                }
            });
            const release = response.data || {};
            const latestVersion = normalizeVersion(release.tag_name);
            const asset = Array.isArray(release.assets)
                ? release.assets.find(item => /\.exe$/i.test(item.name || '')
                    && isOfficialDownloadUrl(item.browser_download_url))
                : null;

            if (!latestVersion || release.draft || release.prerelease || !asset) {
                return { success: false, currentVersion };
            }

            return {
                success: true,
                updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
                currentVersion,
                latestVersion,
                downloadUrl: asset.browser_download_url
            };
        } catch (error) {
            console.warn('[updates] Could not check GitHub releases:', error.message);
            return { success: false, currentVersion };
        }
    }

    async function openDownload(downloadUrl) {
        if (!isOfficialDownloadUrl(downloadUrl)) {
            return { success: false, error: 'INVALID_DOWNLOAD_URL' };
        }
        await shell.openExternal(downloadUrl);
        return { success: true };
    }

    return { check, openDownload };
}

module.exports = { createUpdateService, compareVersions, normalizeVersion };
