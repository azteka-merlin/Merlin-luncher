(() => {
    const VIDEO_URL = 'https://www.youtube-nocookie.com/embed/7Qlv_FP2ed8?rel=0&origin=https%3A%2F%2Fmerlin.local';
    const promptModal = document.getElementById('tutorialPromptModal');
    const videoModal = document.getElementById('tutorialVideoModal');
    const video = document.getElementById('tutorialVideo');
    const watchButton = document.getElementById('tutorialWatchBtn');
    const notNowButton = document.getElementById('tutorialNotNowBtn');
    const closeButton = document.getElementById('tutorialCloseBtn');

    function openVideo() {
        promptModal.hidden = true;
        video.src = VIDEO_URL;
        videoModal.hidden = false;
        closeButton.focus();
    }

    function closeVideo() {
        videoModal.hidden = true;
        video.src = '';
    }

    async function answerPrompt(watch) {
        await window.electronAPI.saveConfig({ tutorialPromptSeen: true });
        promptModal.hidden = true;
        if (watch) openVideo();
    }

    watchButton.addEventListener('click', () => answerPrompt(true));
    notNowButton.addEventListener('click', () => answerPrompt(false));
    closeButton.addEventListener('click', closeVideo);

    videoModal.addEventListener('click', event => {
        if (event.target === videoModal) closeVideo();
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !videoModal.hidden) closeVideo();
    });

    window.electronAPI.onOpenTutorial(openVideo);

    window.addEventListener('merlin-language-changed', async () => {
        const config = await window.electronAPI.getConfig();
        if (!config.tutorialPromptSeen) {
            promptModal.hidden = false;
            watchButton.focus();
        }
    }, { once: true });
})();
