(() => {
    const translations = {
        ptbr: ['Nova versão disponível', 'O Merlin {version} está disponível. Você está usando a versão {current}.', 'Agora não', 'Baixar atualização'],
        en: ['New version available', 'Merlin {version} is available. You are using version {current}.', 'Later', 'Download update'],
        es: ['Nueva versión disponible', 'Merlin {version} está disponible. Está usando la versión {current}.', 'Ahora no', 'Descargar actualización'],
        fr: ['Nouvelle version disponible', 'Merlin {version} est disponible. Vous utilisez la version {current}.', 'Plus tard', 'Télécharger la mise à jour'],
        de: ['Neue Version verfügbar', 'Merlin {version} ist verfügbar. Sie verwenden Version {current}.', 'Später', 'Update herunterladen']
    };
    const badge = document.getElementById('appVersion');
    const modal = document.getElementById('updateAvailableModal');
    const title = document.getElementById('updateAvailableTitle');
    const message = document.getElementById('updateAvailableMessage');
    const later = document.getElementById('updateLaterBtn');
    const download = document.getElementById('updateDownloadBtn');
    let update = null;

    function render() {
        if (!update) return;
        const language = document.getElementById('languageSelect')?.value || 'en';
        const text = translations[language] || translations.en;
        title.textContent = text[0];
        message.textContent = text[1].replace('{version}', update.latestVersion).replace('{current}', update.currentVersion);
        later.textContent = text[2];
        download.textContent = text[3];
    }

    later.addEventListener('click', () => { modal.hidden = true; });
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
    window.addEventListener('merlin-language-changed', render);

    document.addEventListener('DOMContentLoaded', async () => {
        const version = await window.electronAPI.getVersion();
        badge.textContent = `v${version}`;
        const result = await window.electronAPI.checkForUpdates();
        if (!result?.success || !result.updateAvailable) return;
        update = result;
        render();
        modal.hidden = false;
    });
})();
