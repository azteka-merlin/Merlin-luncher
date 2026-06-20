(() => {
    const translations = {
        ptbr: {
            title: 'Nova versão disponível',
            message: 'O Merlin {version} está disponível. Você está usando a versão {current}.',
            later: 'Agora não',
            download: 'Baixar atualização',
            badge: 'Atualização'
        },
        en: {
            title: 'New version available',
            message: 'Merlin {version} is available. You are using version {current}.',
            later: 'Later',
            download: 'Download update',
            badge: 'Update'
        },
        es: {
            title: 'Nueva versión disponible',
            message: 'Merlin {version} está disponible. Está usando la versión {current}.',
            later: 'Ahora no',
            download: 'Descargar actualización',
            badge: 'Actualización'
        },
        fr: {
            title: 'Nouvelle version disponible',
            message: 'Merlin {version} est disponible. Vous utilisez la version {current}.',
            later: 'Plus tard',
            download: 'Télécharger la mise à jour',
            badge: 'Mise à jour'
        },
        de: {
            title: 'Neue Version verfügbar',
            message: 'Merlin {version} ist verfügbar. Sie verwenden Version {current}.',
            later: 'Später',
            download: 'Update herunterladen',
            badge: 'Update'
        }
    };
    const versionBadge = document.getElementById('appVersion');
    const updateNoticeBadge = document.getElementById('updateNoticeBadge');
    const updateNoticeBadgeText = document.getElementById('updateNoticeBadgeText');
    const modal = document.getElementById('updateAvailableModal');
    const title = document.getElementById('updateAvailableTitle');
    const message = document.getElementById('updateAvailableMessage');
    const later = document.getElementById('updateLaterBtn');
    const download = document.getElementById('updateDownloadBtn');
    let update = null;

    function getLanguageText() {
        const language = document.getElementById('languageSelect')?.value || 'en';
        return translations[language] || translations.en;
    }

    function render() {
        const text = getLanguageText();
        if (updateNoticeBadgeText) {
            updateNoticeBadgeText.textContent = text.badge;
        }
        if (!update) return;
        title.textContent = text.title;
        message.textContent = text.message
            .replace('{version}', update.latestVersion)
            .replace('{current}', update.currentVersion);
        later.textContent = text.later;
        download.textContent = text.download;
    }

    later.addEventListener('click', () => {
        modal.hidden = true;
    });

    download.addEventListener('click', async () => {
        if (!update) return;
        download.disabled = true;
        try {
            const result = await window.electronAPI.openUpdateDownload(update.downloadUrl);
            if (result?.success) modal.hidden = true;
        } finally {
            download.disabled = false;
        }
    });

    updateNoticeBadge?.addEventListener('click', () => {
        if (!update) return;
        render();
        modal.hidden = false;
    });

    window.addEventListener('merlin-language-changed', render);

    document.addEventListener('DOMContentLoaded', async () => {
        const version = await window.electronAPI.getVersion();
        versionBadge.textContent = `v${version}`;
        render();

        const result = await window.electronAPI.checkForUpdates();
        if (!result?.success || !result.updateAvailable) return;

        update = result;
        render();
        updateNoticeBadge.hidden = false;
        modal.hidden = false;
    });
})();
