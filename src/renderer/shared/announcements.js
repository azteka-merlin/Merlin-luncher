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
    let imageCropCleanup = null;
    const hiddenThisSession = new Set();

    function hasOtherModalOpen() {
        return Array.from(document.querySelectorAll('.library-modal'))
            .some((entry) => entry !== modal && entry.hidden === false);
    }

    function renderAnnouncement(announcement) {
        cleanupImageCropLayout();
        title.textContent = announcement.title || '';
        text.textContent = announcement.bodyText || '';

        dismissCheckbox.checked = false;
        dismissRow.hidden = announcement.allowDismissForever !== true;

        if (announcement.imageUrl) {
            image.src = announcement.imageUrl;
            if (announcement.imageCropArea) {
                applyImageCropLayout(announcement.imageCropArea);
            } else {
                imageWrap.classList.remove('is-cropped');
                image.style.objectFit = announcement.imageFit === 'contain' ? 'contain' : 'cover';
                image.style.objectPosition = `${normalizeImagePosition(announcement.imagePositionX)}% ${normalizeImagePosition(announcement.imagePositionY)}%`;
            }
            imageWrap.hidden = false;
        } else {
            image.removeAttribute('src');
            image.style.removeProperty('object-fit');
            image.style.removeProperty('object-position');
            imageWrap.classList.remove('is-cropped');
            imageWrap.hidden = true;
        }
    }

    function cleanupImageCropLayout() {
        if (imageCropCleanup) {
            imageCropCleanup();
            imageCropCleanup = null;
        }
        image.style.removeProperty('position');
        image.style.removeProperty('width');
        image.style.removeProperty('height');
        image.style.removeProperty('left');
        image.style.removeProperty('top');
        image.style.removeProperty('max-width');
    }

    function applyImageCropLayout(cropArea) {
        imageWrap.classList.add('is-cropped');
        image.style.removeProperty('object-fit');
        image.style.removeProperty('object-position');

        const updateLayout = () => {
            if (!image.naturalWidth || !image.naturalHeight) return;
            const cropWidth = image.naturalWidth * (cropArea.width / 100);
            const cropHeight = image.naturalHeight * (cropArea.height / 100);
            if (!cropWidth || !cropHeight) return;

            const scale = Math.max(imageWrap.clientWidth / cropWidth, imageWrap.clientHeight / cropHeight);
            image.style.position = 'absolute';
            image.style.maxWidth = 'none';
            image.style.width = `${image.naturalWidth * scale}px`;
            image.style.height = `${image.naturalHeight * scale}px`;
            image.style.left = `${-image.naturalWidth * (cropArea.x / 100) * scale}px`;
            image.style.top = `${-image.naturalHeight * (cropArea.y / 100) * scale}px`;
        };

        image.addEventListener('load', updateLayout);
        window.addEventListener('resize', updateLayout);
        if (image.complete) updateLayout();
        imageCropCleanup = () => {
            image.removeEventListener('load', updateLayout);
            window.removeEventListener('resize', updateLayout);
        };
    }

    function normalizeImagePosition(value) {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) return 50;
        return Math.min(100, Math.max(0, Math.round(numberValue)));
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
