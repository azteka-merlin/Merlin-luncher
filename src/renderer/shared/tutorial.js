(() => {
    window.electronAPI.onOpenTutorial(() => {
        if (typeof window.openMerlinWelcomeWizard === 'function') {
            window.openMerlinWelcomeWizard();
        }
    });
})();
