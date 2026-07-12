window.merlinI18n.register({
    ptbr: {
        poll_badge_new: 'Nova enquete',
        poll_badge_results: 'Ver enquete',
        poll_modal_eyebrow: 'MERLIN COMMUNITY',
        poll_close: 'Fechar',
        poll_back: 'Voltar',
        poll_next: 'Próximo',
        poll_close_label: 'Fechar enquete',
        poll_game_title: 'Qual jogo você quer no Premium?',
        poll_basic_description: 'Escolha uma alternativa para ajudar o Merlin a entender melhor a comunidade.',
        poll_game_description: 'Escolha o jogo que você gostaria de ver no Premium.',
        poll_contribution_title: 'Você se disporia a contribuir com algum valor?',
        poll_contribution_description: 'Opcional: isso ajuda o suporte a medir interesse em uma ação coletiva.',
        poll_results_description: 'Você já votou. Acompanhe como a comunidade está respondendo.',
        poll_vote_count_singular: '{count} voto',
        poll_vote_count_plural: '{count} votos',
        poll_vote_failed: 'Não foi possível registrar seu voto agora.',
        poll_no_contribution: 'Sem contribuição'
    },
    en: {
        poll_badge_new: 'New poll',
        poll_badge_results: 'View poll',
        poll_modal_eyebrow: 'MERLIN COMMUNITY',
        poll_close: 'Close',
        poll_back: 'Back',
        poll_next: 'Next',
        poll_close_label: 'Close poll',
        poll_game_title: 'Which game do you want in Premium?',
        poll_basic_description: 'Choose an option to help Merlin understand the community.',
        poll_game_description: 'Choose the game you would like to see in Premium.',
        poll_contribution_title: 'Would you be willing to contribute any amount?',
        poll_contribution_description: 'Optional: this helps support measure interest in a collective action.',
        poll_results_description: 'You already voted. Follow how the community is responding.',
        poll_vote_count_singular: '{count} vote',
        poll_vote_count_plural: '{count} votes',
        poll_vote_failed: 'Could not register your vote right now.',
        poll_no_contribution: 'No contribution'
    },
    es: {
        poll_badge_new: 'Nueva encuesta',
        poll_badge_results: 'Ver encuesta',
        poll_modal_eyebrow: 'COMUNIDAD MERLIN',
        poll_close: 'Cerrar',
        poll_back: 'Volver',
        poll_next: 'Siguiente',
        poll_close_label: 'Cerrar encuesta',
        poll_game_title: '¿Qué juego quieres en Premium?',
        poll_basic_description: 'Elige una alternativa para ayudar a Merlin a entender mejor a la comunidad.',
        poll_game_description: 'Elige el juego que te gustaria ver en Premium.',
        poll_contribution_title: '¿Estarias dispuesto a contribuir con algun valor?',
        poll_contribution_description: 'Opcional: esto ayuda al soporte a medir interes en una accion colectiva.',
        poll_results_description: 'Ya votaste. Mira como esta respondiendo la comunidad.',
        poll_vote_count_singular: '{count} voto',
        poll_vote_count_plural: '{count} votos',
        poll_vote_failed: 'No se pudo registrar tu voto ahora.',
        poll_no_contribution: 'Sin contribución'
    },
    fr: {
        poll_badge_new: 'Nouveau sondage',
        poll_badge_results: 'Voir sondage',
        poll_modal_eyebrow: 'COMMUNAUTE MERLIN',
        poll_close: 'Fermer',
        poll_back: 'Retour',
        poll_next: 'Suivant',
        poll_close_label: 'Fermer le sondage',
        poll_game_title: 'Quel jeu voulez-vous dans Premium ?',
        poll_basic_description: 'Choisissez une option pour aider Merlin a mieux comprendre la communaute.',
        poll_game_description: 'Choisissez le jeu que vous aimeriez voir dans Premium.',
        poll_contribution_title: 'Seriez-vous pret a contribuer un montant ?',
        poll_contribution_description: 'Optionnel : cela aide le support a mesurer linteret pour une action collective.',
        poll_results_description: 'Vous avez deja vote. Suivez les reponses de la communaute.',
        poll_vote_count_singular: '{count} vote',
        poll_vote_count_plural: '{count} votes',
        poll_vote_failed: 'Impossible denregistrer votre vote pour le moment.',
        poll_no_contribution: 'Sans contribution'
    },
    de: {
        poll_badge_new: 'Neue Umfrage',
        poll_badge_results: 'Umfrage ansehen',
        poll_modal_eyebrow: 'MERLIN COMMUNITY',
        poll_close: 'Schliessen',
        poll_back: 'Zurueck',
        poll_next: 'Weiter',
        poll_close_label: 'Umfrage schliessen',
        poll_game_title: 'Welches Spiel moechtest du in Premium sehen?',
        poll_basic_description: 'Waehle eine Option, damit Merlin die Community besser versteht.',
        poll_game_description: 'Waehle das Spiel, das du in Premium sehen moechtest.',
        poll_contribution_title: 'Waerst du bereit, einen Betrag beizutragen?',
        poll_contribution_description: 'Optional: Das hilft dem Support, Interesse an einer gemeinsamen Aktion zu messen.',
        poll_results_description: 'Du hast bereits abgestimmt. Verfolge, wie die Community antwortet.',
        poll_vote_count_singular: '{count} Stimme',
        poll_vote_count_plural: '{count} Stimmen',
        poll_vote_failed: 'Deine Stimme konnte gerade nicht gespeichert werden.',
        poll_no_contribution: 'Kein Beitrag'
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const badge = document.getElementById('pollNoticeBadge');
    const badgeText = document.getElementById('pollNoticeBadgeText');
    const modal = document.getElementById('pollModal');
    const title = document.getElementById('pollModalTitle');
    const description = document.getElementById('pollModalDescription');
    const optionsBox = document.getElementById('pollModalOptions');
    const closeTopBtn = document.getElementById('pollModalCloseTopBtn');
    const closeBtn = document.getElementById('pollModalCloseBtn');
    const backBtn = document.getElementById('pollModalBackBtn');
    const skipBtn = document.getElementById('pollModalSkipBtn');
    const nextBtn = document.getElementById('pollModalNextBtn');

    if (!badge || !modal || !window.electronAPI?.polls) return;

    let polls = [];
    let activePoll = null;
    let step = 'main';
    let voting = false;
    let lastRefreshAt = 0;

    function tr(key, params = {}) {
        let value = window.merlinI18n.t(key);
        for (const [name, replacement] of Object.entries(params)) {
            value = value.replace(`{${name}}`, String(replacement));
        }
        return value;
    }

    function localeForLanguage() {
        const language = window.merlinI18n.current();
        if (language === 'ptbr') return 'pt-BR';
        if (language === 'es') return 'es-ES';
        if (language === 'fr') return 'fr-FR';
        if (language === 'de') return 'de-DE';
        return 'en-US';
    }

    function currencyForLanguage() {
        const language = window.merlinI18n.current();
        if (language === 'ptbr') return 'BRL';
        if (language === 'en') return 'USD';
        return 'EUR';
    }

    function formatVoteCount(count) {
        const key = Number(count) === 1 ? 'poll_vote_count_singular' : 'poll_vote_count_plural';
        return tr(key, { count });
    }

    function formatMoney(value) {
        return new Intl.NumberFormat(localeForLanguage(), {
            style: 'currency',
            currency: currencyForLanguage(),
            maximumFractionDigits: 0
        }).format(Number(value) || 0);
    }

    function formatContributionLabel(option, poll) {
        if (option.minAmount === null && option.maxAmount === null) {
            return option.label === '__none__' ? tr('poll_no_contribution') : (option.label || tr('poll_no_contribution'));
        }
        if (option.minAmount !== null && option.maxAmount !== null) {
            return `${formatMoney(option.minAmount)} a ${formatMoney(option.maxAmount)}`;
        }
        return option.label;
    }

    function isPollComplete(poll) {
        if (!poll?.viewer?.voted) return false;
        if (poll.type !== 'game_request') return true;
        return Boolean(poll.viewer.contributionOptionId || poll.viewer.contributionSkipped);
    }

    function selectedOption(poll) {
        return poll.options.find(option => option.id === poll.viewer.optionId) || null;
    }

    function updateBadge() {
        activePoll = polls[0] || null;
        if (!activePoll) {
            badge.hidden = true;
            return;
        }

        badge.hidden = false;
        const complete = isPollComplete(activePoll);
        badge.classList.toggle('is-voted', complete);
        badgeText.textContent = complete ? tr('poll_badge_results') : tr('poll_badge_new');
    }

    function resultRow({ label, votes, percent, selected, disabled, onClick }) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `poll-option ${selected ? 'is-selected' : ''}`;
        button.disabled = disabled === true || voting;
        if (typeof onClick === 'function') button.addEventListener('click', onClick);

        const head = document.createElement('span');
        head.className = 'poll-option__head';

        const labelEl = document.createElement('strong');
        labelEl.textContent = label;
        const countEl = document.createElement('em');
        countEl.textContent = `${formatVoteCount(votes)} · ${percent}%`;

        const bar = document.createElement('span');
        bar.className = 'poll-option__bar';
        const fill = document.createElement('span');
        fill.style.width = `${Math.max(0, Math.min(100, percent || 0))}%`;
        bar.appendChild(fill);

        head.append(labelEl, countEl);
        button.append(head, bar);
        return button;
    }

    function renderMainStep(poll) {
        step = 'main';
        title.textContent = poll.type === 'game_request' ? tr('poll_game_title') : poll.question;
        description.textContent = poll.viewer.voted
            ? tr('poll_results_description')
            : poll.type === 'game_request'
                ? tr('poll_game_description')
                : tr('poll_basic_description');
        optionsBox.replaceChildren();

        for (const option of poll.options) {
            optionsBox.appendChild(resultRow({
                label: option.label,
                votes: option.votes,
                percent: option.percent,
                selected: option.selected,
                disabled: poll.viewer.voted,
                onClick: poll.viewer.voted ? null : () => submitVote({ optionId: option.id })
            }));
        }

        skipBtn.hidden = true;
        backBtn.hidden = true;
        nextBtn.hidden = !(poll.type === 'game_request' && poll.viewer.voted);
    }

    function renderContributionStep(poll) {
        step = 'contribution';
        const selected = selectedOption(poll);
        const results = poll.contributionResultsByOptionId?.[String(selected?.id || '')] || [];
        title.textContent = tr('poll_contribution_title');
        description.textContent = poll.viewer.contributionOptionId || poll.viewer.contributionSkipped
            ? tr('poll_results_description')
            : tr('poll_contribution_description');
        optionsBox.replaceChildren();

        for (const option of results) {
            const canVote = poll.viewer.voted && !poll.viewer.contributionOptionId && !poll.viewer.contributionSkipped && option.id !== null;
            optionsBox.appendChild(resultRow({
                label: formatContributionLabel(option, poll),
                votes: option.votes,
                percent: option.percent,
                selected: option.selected,
                disabled: !canVote,
                onClick: canVote ? () => submitVote({ contributionOptionId: option.id }) : null
            }));
        }

        backBtn.hidden = false;
        skipBtn.hidden = true;
        nextBtn.hidden = true;
    }

    function renderModal() {
        if (!activePoll) return;
        if (step === 'contribution') {
            renderContributionStep(activePoll);
        } else {
            renderMainStep(activePoll);
        }
    }

    async function submitVote(payload) {
        if (!activePoll || voting) return;
        voting = true;
        renderModal();
        try {
            const result = await window.electronAPI.polls.vote({
                pollId: activePoll.id,
                ...payload
            });
            if (!result?.success || !result.poll) {
                throw new Error(result?.message || tr('poll_vote_failed'));
            }

            activePoll = result.poll;
            polls = polls.map(poll => poll.id === activePoll.id ? activePoll : poll);
            updateBadge();
            if (activePoll.type === 'game_request' && payload.optionId && !activePoll.viewer.contributionOptionId && !activePoll.viewer.contributionSkipped) {
                step = 'contribution';
            }
        } catch (error) {
            if (typeof window.showNotification === 'function') {
                window.showNotification(error.message || tr('poll_vote_failed'), 'error');
            }
        } finally {
            voting = false;
            renderModal();
        }
    }

    function openModal() {
        if (!activePoll) return;
        step = 'main';
        renderModal();
        modal.hidden = false;
    }

    function closeModal() {
        modal.hidden = true;
    }

    async function refreshPolls() {
        lastRefreshAt = Date.now();
        const result = await window.electronAPI.polls.active();
        if (result?.success) {
            polls = result.polls || [];
            updateBadge();
        }
    }

    badge.addEventListener('click', openModal);
    closeTopBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    backBtn.addEventListener('click', () => {
        step = 'main';
        renderModal();
    });
    nextBtn.addEventListener('click', () => {
        step = 'contribution';
        renderModal();
    });

    window.addEventListener('merlin-language-changed', () => {
        updateBadge();
        if (!modal.hidden) renderModal();
    });
    function refreshPollsSoon() {
        if (Date.now() - lastRefreshAt < 15000) return;
        refreshPolls();
    }

    window.addEventListener('merlin-authenticated', refreshPolls);
    window.addEventListener('merlin-view-changed', refreshPollsSoon);

    setTimeout(refreshPolls, 900);
    setInterval(refreshPolls, 5 * 60 * 1000);
});
