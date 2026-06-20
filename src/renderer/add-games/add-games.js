document.addEventListener('DOMContentLoaded', async () => {
    const api = window.electronAPI.games;
    const siteSelector = document.getElementById('siteSelector');
    const addGamesNavBtn = document.getElementById('addGamesNavBtn');
    const linkModeBtn = document.getElementById('linkModeBtn');
    const steamStoreModeBtn = document.getElementById('steamStoreModeBtn');
    const webview = document.getElementById('webview');
    const addGamesView = document.getElementById('addGamesView');
    const browserToolbar = document.querySelector('.browser-toolbar');
    const steamActionsCard = document.getElementById('steamActionsCard');
    const linkInput = document.getElementById('gameLinkInput');
    const queueList = document.getElementById('gameQueueList');
    const queueCount = document.getElementById('queueCount');
    const installAllCount = document.getElementById('installAllCount');
    const clearQueueBtn = document.getElementById('clearQueueBtn');
    const installNowBtn = document.getElementById('installNowBtn');
    const addToQueueBtn = document.getElementById('addToQueueBtn');
    const installAllBtn = document.getElementById('installAllBtn');
    const feedback = document.getElementById('addGamesFeedback');

    let queueState = { items: [], count: 0, locked: false, installing: false };
    let requestBusy = false;

    function tr(key, values = {}) {
        const template = window.merlinI18n?.t(key) || key;
        return Object.entries(values).reduce(
            (text, [name, value]) => text.replaceAll(`{${name}}`, value),
            template
        );
    }

    function errorMessage(result, fallbackKey = 'games_error_generic') {
        const code = result?.code || result?.reason;
        const key = code ? `games_error_${code}` : fallbackKey;
        const translated = tr(key);
        return translated === key ? tr(fallbackKey) : translated;
    }

    function progressMessage(message, stage) {
        if (stage === 'downloading' || /download attempt|downloading manifests/i.test(message)) {
            return tr('games_progress_downloading');
        }
        if (/extracting/i.test(message)) return tr('games_progress_extracting');
        if (/installing/i.test(message)) return tr('games_progress_installing');
        if (/cleaning/i.test(message)) return tr('games_progress_cleaning');
        if (/complete/i.test(message)) return tr('games_progress_complete');
        return message;
    }

    function showFeedback(message = '', type = 'info') {
        feedback.textContent = message;
        feedback.dataset.type = type;
        feedback.hidden = !message;
    }

    function setRequestBusy(value) {
        requestBusy = value;
        updateControls();
    }

    function updateControls() {
        const locked = requestBusy || queueState.locked || queueState.installing;
        linkInput.disabled = locked;
        installNowBtn.disabled = locked || queueState.count > 0;
        addToQueueBtn.disabled = locked;
        installAllBtn.disabled = locked || queueState.count === 0;
        clearQueueBtn.disabled = locked || queueState.count === 0;
        queueList.querySelectorAll('.remove-game-btn').forEach(button => {
            button.disabled = locked;
        });
    }

    function renderQueue(nextState) {
        queueState = nextState || queueState;
        queueList.replaceChildren();

        for (const game of queueState.items) {
            const item = document.createElement('li');
            item.className = 'game-queue-item';

            const name = document.createElement('span');
            name.className = 'game-queue-name';
            name.textContent = game.name;
            name.title = `${game.name} (${game.appId})`;

            const removeButton = document.createElement('button');
            removeButton.className = 'remove-game-btn';
            removeButton.type = 'button';
            removeButton.setAttribute('aria-label', tr('remove_from_queue', { name: game.name }));
            removeButton.dataset.appId = game.appId;
            removeButton.innerHTML = `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6"></path>
                </svg>`;

            item.append(name, removeButton);
            queueList.append(item);
        }

        queueCount.textContent = `(${queueState.count})`;
        installAllCount.textContent = `(${queueState.count})`;
        clearQueueBtn.hidden = queueState.count === 0;
        updateControls();
    }

    function updateVisibleView() {
        const showAddGames = siteSelector.value === 'add-games';
        addGamesView.hidden = !showAddGames;
        webview.hidden = showAddGames;
        if (showAddGames) webview.blur();
        browserToolbar.classList.toggle('native-content-active', showAddGames);
        steamActionsCard.hidden = showAddGames;
        linkModeBtn.classList.toggle('active', showAddGames);
        linkModeBtn.setAttribute('aria-pressed', String(showAddGames));
        steamStoreModeBtn.classList.toggle('active', !showAddGames);
        steamStoreModeBtn.setAttribute('aria-pressed', String(!showAddGames));
    }

    function selectMode(value) {
        siteSelector.value = value;
        siteSelector.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async function addToQueue() {
        setRequestBusy(true);
        showFeedback(tr('games_resolving'));
        try {
            const result = await api.addToQueue(linkInput.value);
            if (!result.success) {
                showFeedback(errorMessage(result), 'error');
                return;
            }
            renderQueue(result.queue);
            linkInput.value = '';
            showFeedback(tr('games_added', { name: result.item.name }), 'success');
        } catch (_) {
            showFeedback(tr('games_add_failed'), 'error');
        } finally {
            setRequestBusy(false);
        }
    }

    async function installNow() {
        setRequestBusy(true);
        showFeedback(tr('games_install_preparing'));
        try {
            const result = await api.installNow(linkInput.value);
            if (!result.success) {
                showFeedback(errorMessage(result, 'games_install_failed'), 'error');
                return;
            }
            linkInput.value = '';
            showFeedback(tr('games_install_success', { name: result.item.name }), 'success');
            if (await window.merlinRestartPrompt.ask({ message: tr('games_restart_prompt') })) {
                const restart = await api.restartSteam();
                showFeedback(
                    tr(restart.success ? 'games_restart_success' : 'games_restart_failed'),
                    restart.success ? 'success' : 'error'
                );
            }
        } catch (_) {
            showFeedback(tr('games_install_failed'), 'error');
        } finally {
            setRequestBusy(false);
        }
    }

    async function installAll() {
        setRequestBusy(true);
        showFeedback(tr('games_batch_start'));
        try {
            const result = await api.installAll();
            if (result.code) {
                showFeedback(errorMessage(result), 'error');
                return;
            }

            const installed = result.installed.length;
            const failed = result.failed.length;
            const summary = tr('games_batch_summary', { installed, failed });
            showFeedback(summary, failed > 0 ? 'error' : 'success');

            if (installed > 0 && await window.merlinRestartPrompt.ask({
                message: tr('games_batch_restart_prompt', { summary })
            })) {
                const restart = await api.restartSteam();
                showFeedback(
                    tr(restart.success ? 'games_restart_success' : 'games_restart_failed'),
                    restart.success ? 'success' : 'error'
                );
            }
        } catch (_) {
            showFeedback(tr('games_batch_failed'), 'error');
        } finally {
            setRequestBusy(false);
        }
    }

    siteSelector.addEventListener('change', updateVisibleView);
    addGamesNavBtn.addEventListener('click', () => selectMode('add-games'));
    linkModeBtn.addEventListener('click', () => selectMode('add-games'));
    steamStoreModeBtn.addEventListener('click', () => selectMode('https://store.steampowered.com'));
    window.addEventListener('merlin-language-changed', () => renderQueue(queueState));
    addToQueueBtn.addEventListener('click', addToQueue);
    installNowBtn.addEventListener('click', installNow);
    installAllBtn.addEventListener('click', installAll);
    linkInput.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !addToQueueBtn.disabled) addToQueue();
    });

    queueList.addEventListener('click', async event => {
        const button = event.target.closest('.remove-game-btn');
        if (!button || button.disabled) return;
        const result = await api.removeFromQueue(button.dataset.appId);
        if (result.success) renderQueue(result.queue);
        else showFeedback(errorMessage(result), 'error');
    });

    clearQueueBtn.addEventListener('click', async () => {
        const result = await api.clearQueue();
        if (result.success) {
            renderQueue(result.queue);
            showFeedback(tr('games_queue_cleared'));
        } else {
            showFeedback(errorMessage(result), 'error');
        }
    });

    api.onQueueUpdated(renderQueue);
    api.onInstallProgress(progress => {
        showFeedback(tr('games_progress', {
            current: progress.current,
            total: progress.total,
            name: progress.name,
            message: progressMessage(progress.message, progress.stage),
            percent: progress.percent
        }));
    });

    try {
        renderQueue(await api.listQueue());
    } catch (_) {
        showFeedback(tr('games_queue_load_failed'), 'error');
    }
    updateVisibleView();
});
