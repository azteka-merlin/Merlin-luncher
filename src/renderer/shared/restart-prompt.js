window.merlinI18n.register({
    ptbr: { restart_prompt_title: 'Reiniciar a Steam?', restart_prompt_later: 'Depois', restart_prompt_action: 'Reiniciar Steam' },
    en: { restart_prompt_title: 'Restart Steam?', restart_prompt_later: 'Later', restart_prompt_action: 'Restart Steam' },
    es: { restart_prompt_title: '¿Reiniciar Steam?', restart_prompt_later: 'Más tarde', restart_prompt_action: 'Reiniciar Steam' },
    fr: { restart_prompt_title: 'Redémarrer Steam ?', restart_prompt_later: 'Plus tard', restart_prompt_action: 'Redémarrer Steam' },
    de: { restart_prompt_title: 'Steam neu starten?', restart_prompt_later: 'Später', restart_prompt_action: 'Steam neu starten' }
});

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('steamRestartModal');
    const title = document.getElementById('steamRestartModalTitle');
    const message = document.getElementById('steamRestartModalMessage');
    const later = document.getElementById('steamRestartLaterBtn');
    const restart = document.getElementById('steamRestartNowBtn');
    let resolvePrompt = null;
    let previousFocus = null;
    const defaults = {
        title: title.textContent,
        cancelLabel: later.textContent,
        actionLabel: restart.textContent
    };
    const i18nDefaults = {
        title: title.getAttribute('data-i18n'),
        cancelLabel: later.getAttribute('data-i18n'),
        actionLabel: restart.getAttribute('data-i18n')
    };

    function applyPromptLabel(element, options = {}) {
        const {
            i18nKey,
            text,
            fallbackText,
            defaultI18nKey
        } = options;

        if (i18nKey) {
            element.setAttribute('data-i18n', i18nKey);
            element.textContent = window.merlinI18n?.t(i18nKey) || text || fallbackText;
            return;
        }

        if (text) {
            element.removeAttribute('data-i18n');
            element.textContent = text;
            return;
        }

        if (defaultI18nKey) {
            element.setAttribute('data-i18n', defaultI18nKey);
        }
        element.textContent = fallbackText;
    }

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
        applyPromptLabel(title, {
            i18nKey: options.titleKey,
            text: options.title,
            fallbackText: defaults.title,
            defaultI18nKey: i18nDefaults.title
        });
        if (options.messageKey) {
            message.setAttribute('data-i18n', options.messageKey);
            message.textContent = window.merlinI18n?.t(options.messageKey) || options.message || '';
        } else {
            message.removeAttribute('data-i18n');
            message.textContent = options.message || '';
        }
        applyPromptLabel(later, {
            i18nKey: options.cancelKey,
            text: options.cancelLabel,
            fallbackText: defaults.cancelLabel,
            defaultI18nKey: i18nDefaults.cancelLabel
        });
        applyPromptLabel(restart, {
            i18nKey: options.actionKey,
            text: options.actionLabel,
            fallbackText: defaults.actionLabel,
            defaultI18nKey: i18nDefaults.actionLabel
        });
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
