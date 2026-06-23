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

function getDownloadFileName(downloadUrl, fallbackVersion) {
    try {
        const url = new URL(downloadUrl);
        const name = decodeURIComponent(url.pathname.split('/').pop() || '');
        if (/\.exe$/i.test(name)) return name;
    } catch {}
    return `Merlin-Setup-${normalizeVersion(fallbackVersion) || 'latest'}.exe`;
}

function createUpdateService({ app, axios, shell, path, downloadManager }) {
    async function check() {
        const currentVersion = app.getVersion();
        if (!app.isPackaged && process.env.MERLIN_SIMULATE_UPDATE === '1') {
            const downloadUrl = process.env.MERLIN_SIMULATE_UPDATE_URL || '';
            if (!isOfficialDownloadUrl(downloadUrl)) {
                console.warn('[updates] MERLIN_SIMULATE_UPDATE_URL must be an official Merlin release asset URL.');
                return { success: false, currentVersion };
            }

            return {
                success: true,
                updateAvailable: true,
                currentVersion,
                latestVersion: normalizeVersion(process.env.MERLIN_SIMULATE_UPDATE_VERSION || '99.0.0'),
                downloadUrl
            };
        }

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

    async function downloadUpdate({ operationId, downloadUrl, latestVersion, onProgress = () => {} }) {
        if (!isOfficialDownloadUrl(downloadUrl)) {
            return { success: false, code: 'invalid_download_url' };
        }

        const fileName = getDownloadFileName(downloadUrl, latestVersion);
        const destinationPath = path.join(app.getPath('downloads'), fileName);
        const result = await downloadManager.download({
            operationId,
            url: downloadUrl,
            destinationPath,
            headers: {
                Accept: 'application/octet-stream',
                'User-Agent': `Merlin/${app.getVersion()}`
            },
            onProgress
        });

        if (!result.success) return result;
        return {
            ...result,
            fileName,
            folderPath: path.dirname(result.filePath)
        };
    }

    function cancelDownload(operationId) {
        return downloadManager.cancel(operationId);
    }

    async function openDownloadedFile(filePath) {
        if (!filePath || !/\.exe$/i.test(filePath)) {
            return { success: false, code: 'invalid_file' };
        }
        const error = await shell.openPath(filePath);
        return error ? { success: false, code: 'open_failed', message: error } : { success: true };
    }

    async function openDownloadedFolder(folderPath) {
        if (!folderPath) return { success: false, code: 'invalid_folder' };
        const error = await shell.openPath(folderPath);
        return error ? { success: false, code: 'open_failed', message: error } : { success: true };
    }

    return { cancelDownload, check, downloadUpdate, openDownload, openDownloadedFile, openDownloadedFolder };
}

module.exports = { createUpdateService, compareVersions, normalizeVersion };
