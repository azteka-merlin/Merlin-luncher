document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('announcementModal');
    const closeBtn = document.getElementById('announcementModalCloseBtn');
    const imageWrap = document.getElementById('announcementModalImageWrap');
    const image = document.getElementById('announcementModalImage');
    const title = document.getElementById('announcementModalTitle');
    const text = document.getElementById('announcementModalText');
    const dismissRow = document.getElementById('announcementModalDismissRow');
    const dismissCheckbox = document.getElementById('announcementModalDismissCheckbox');

    if (!modal || !closeBtn || !window.electronAPI?.announcements) return;

    let activeAnnouncement = null;
    let loading = false;
    let lastRefreshAt = 0;
    const hiddenThisSession = new Set();

    function hasOtherModalOpen() {
        return Array.from(document.querySelectorAll('.library-modal'))
            .some((entry) => entry !== modal && entry.hidden === false);
    }

    function renderAnnouncement(announcement) {
        title.textContent = announcement.title || '';
        text.textContent = announcement.bodyText || '';

        dismissCheckbox.checked = false;
        dismissRow.hidden = announcement.allowDismissForever !== true;

        if (announcement.imageUrl) {
            image.src = announcement.imageUrl;
            imageWrap.hidden = false;
        } else {
            image.removeAttribute('src');
            imageWrap.hidden = true;
        }
    }

    async function recordOpenedView(announcement) {
        const result = await window.electronAPI.announcements.recordView({
            announcementId: announcement.id
        });
        if (!result?.success && typeof window.showNotification === 'function') {
            window.showNotification(result?.message || 'Nao foi possivel registrar a visualizacao do comunicado.', 'warning');
        }
    }

    async function openAnnouncement(announcement) {
        if (!announcement || hiddenThisSession.has(announcement.id) || hasOtherModalOpen()) return;
        activeAnnouncement = announcement;
        renderAnnouncement(announcement);
        modal.hidden = false;
        await recordOpenedView(announcement);
    }

    async function closeAnnouncement() {
        const announcement = activeAnnouncement;
        if (!announcement) {
            modal.hidden = true;
            return;
        }

        hiddenThisSession.add(announcement.id);
        modal.hidden = true;

        if (announcement.allowDismissForever && dismissCheckbox.checked) {
            const result = await window.electronAPI.announcements.dismiss({
                announcementId: announcement.id
            });
            if (!result?.success && typeof window.showNotification === 'function') {
                window.showNotification(result?.message || 'Nao foi possivel salvar o opt-out do comunicado.', 'warning');
            }
        }
    }

    async function refreshAnnouncement() {
        if (loading) return;
        loading = true;
        lastRefreshAt = Date.now();
        try {
            const result = await window.electronAPI.announcements.eligible();
            if (!result?.success || !result.announcement) return;
            await openAnnouncement(result.announcement);
        } finally {
            loading = false;
        }
    }

    function refreshAnnouncementSoon() {
        if (Date.now() - lastRefreshAt < 15000) return;
        refreshAnnouncement();
    }

    image.addEventListener('error', () => {
        image.removeAttribute('src');
        imageWrap.hidden = true;
    });
    closeBtn.addEventListener('click', closeAnnouncement);
    window.addEventListener('merlin-authenticated', refreshAnnouncement);
    window.addEventListener('merlin-view-changed', refreshAnnouncementSoon);

    setTimeout(refreshAnnouncement, 1200);
    setInterval(refreshAnnouncement, 5 * 60 * 1000);
});
