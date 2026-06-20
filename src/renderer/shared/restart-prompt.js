window.merlinI18n.register({
    ptbr: { restart_prompt_title: 'Reiniciar a Steam?', restart_prompt_later: 'Depois', restart_prompt_action: 'Reiniciar Steam' },
    en: { restart_prompt_title: 'Restart Steam?', restart_prompt_later: 'Later', restart_prompt_action: 'Restart Steam' },
    es: { restart_prompt_title: '¿Reiniciar Steam?', restart_prompt_later: 'Más tarde', restart_prompt_action: 'Reiniciar Steam' },
    fr: { restart_prompt_title: 'Redémarrer Steam ?', restart_prompt_later: 'Plus tard', restart_prompt_action: 'Redémarrer Steam' },
    de: { restart_prompt_title: 'Steam neu starten?', restart_prompt_later: 'Später', restart_prompt_action: 'Steam neu starten' }
});

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('steamRestartModal');
    const message = document.getElementById('steamRestartModalMessage');
    const later = document.getElementById('steamRestartLaterBtn');
    const restart = document.getElementById('steamRestartNowBtn');
    let resolvePrompt = null;
    let previousFocus = null;

    function close(value) {
        modal.hidden = true;
        const resolve = resolvePrompt;
        resolvePrompt = null;
        resolve?.(value);
        requestAnimationFrame(() => previousFocus?.focus());
    }

    function ask(options = {}) {
        if (resolvePrompt) close(false);
        previousFocus = document.activeElement;
        message.textContent = options.message || '';
        modal.hidden = false;
        restart.focus();
        return new Promise(resolve => { resolvePrompt = resolve; });
    }

    later.addEventListener('click', () => close(false));
    restart.addEventListener('click', () => close(true));
    modal.addEventListener('click', event => {
        if (event.target === modal) close(false);
    });
    window.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !modal.hidden) close(false);
    });

    window.merlinRestartPrompt = { ask };
});
