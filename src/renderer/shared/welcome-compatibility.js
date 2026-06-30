(() => {
    const modal = document.getElementById('welcomeModal');
    const body = document.getElementById('welcomeModalBody');
    const stepLabel = document.getElementById('welcomeModalStepLabel');
    const progressBars = Array.from(document.querySelectorAll('.welcome-modal-progress-bars span'));
    const backButton = document.getElementById('welcomeModalBackBtn');
    const skipButton = document.getElementById('welcomeModalSkipBtn');
    const nextButton = document.getElementById('welcomeModalNextBtn');

    if (!modal || !body || !stepLabel || !backButton || !skipButton || !nextButton) return;

    const messages = {
        en: {
            welcome_step_label: 'STEP {current} OF {total}',
            welcome_skip: 'Skip',
            welcome_back: 'Back',
            welcome_next: 'Next',
            welcome_finish: 'Understood, continue',

            welcome_intro_title: 'Welcome to Merlin',
            welcome_intro_hint: 'You can access this tutorial again later from the Help menu.',

            welcome_rules_title: 'Games that usually do not work',
            welcome_rules_intro: 'Some types of games usually do not work in Merlin:',
            welcome_rules_item_online_title: '100% online games',
            welcome_rules_item_online_text: 'Games that depend entirely on servers, mandatory login, or a permanent connection.',
            welcome_rules_item_denuvo_title: 'Games with Denuvo / Anti-tamper',
            welcome_rules_item_denuvo_text: 'If the game has the Denuvo Anti-tamper tag, it will only work if a correction is available for it.',
            welcome_rules_item_launcher_title: 'Games with a mandatory external launcher',
            welcome_rules_item_launcher_text: 'Games that require accounts or launchers such as Ubisoft Connect, EA App, Rockstar Games Launcher, 2K Account, and other mandatory external launchers.',
            welcome_rules_closing: 'If the game requires a third-party account or a link to another launcher, it may not work without a specific correction.',
            welcome_rules_note: 'Important: games with co-op or online multiplayer that can also be played offline usually work in Merlin.',

            welcome_compare_title: 'How do I know if my game will work?',
            welcome_compare_intro_1: 'On the game page, pay attention to Steam warnings.',
            welcome_compare_intro_2: 'If you see any of these warnings, look for the game in Merlin\'s Corrections tab:',
            welcome_compare_tag_denuvo: 'Third-party DRM: Denuvo Anti-tamper',
            welcome_compare_tag_account: 'Requires a third-party account',
            welcome_compare_eula_lead: '"Requires acceptance of a third-party EULA" (example below) is usually not a problem.',
            welcome_compare_eula_body: 'In most cases, this is only a contract/license warning from the game.',
            welcome_compare_eula_tag: "Requires acceptance of a third-party EULA<br>Assassin's Creed Shadows EULA",

            welcome_summary_title: 'Quick summary',
            welcome_summary_intro: 'Before adding a game, remember this:',
            welcome_summary_row_1_q: 'Denuvo or third-party account?',
            welcome_summary_row_1_a: 'Check the Corrections tab.',
            welcome_summary_row_2_q: 'No correction available?',
            welcome_summary_row_2_a: 'It probably will not work.',
            welcome_summary_row_3_q: 'Is it 100% online?',
            welcome_summary_row_3_a: 'It probably will not work.',
            welcome_summary_row_4_q: 'Only an EULA warning?',
            welcome_summary_row_4_a: 'It usually works.'
        },
        ptbr: {
            welcome_step_label: 'PASSO {current} DE {total}',
            welcome_skip: 'Pular',
            welcome_back: 'Voltar',
            welcome_next: 'Próximo',
            welcome_finish: 'Entendi, continuar',

            welcome_intro_title: 'Bem-vindo ao Merlin',
            welcome_intro_hint: 'Você pode acessar este tutorial novamente depois pelo menu Ajuda.',

            welcome_rules_title: 'Jogos que geralmente não funcionam',
            welcome_rules_intro: 'Alguns tipos de jogos normalmente não funcionam no Merlin:',
            welcome_rules_item_online_title: 'Jogos 100% online',
            welcome_rules_item_online_text: 'Jogos que dependem totalmente de servidores, login obrigatório ou conexão permanente.',
            welcome_rules_item_denuvo_title: 'Jogos com Denuvo / Anti-tamper',
            welcome_rules_item_denuvo_text: 'Se o jogo tiver a tag de Denuvo Anti-tamper, ele só funcionará caso exista uma correção disponível para ele.',
            welcome_rules_item_launcher_title: 'Jogos com launcher externo obrigatório',
            welcome_rules_item_launcher_text: 'Jogos que exigem contas ou launchers como Ubisoft Connect, EA App, Rockstar Games Launcher, 2K Account e outros launchers externos obrigatórios.',
            welcome_rules_closing: 'Se o jogo pedir conta de terceiros ou vínculo com outro launcher, ele pode não funcionar sem uma correção específica.',
            welcome_rules_note: 'Importante: jogos com co-op ou multiplayer online, mas que também podem ser jogados offline, normalmente funcionam no Merlin.',

            welcome_compare_title: 'Como saber se meu jogo vai funcionar?',
            welcome_compare_intro_1: 'Na página do jogo, fique atento aos avisos da Steam.',
            welcome_compare_intro_2: 'Se aparecer algum desses avisos, procure o jogo na aba Correções do Merlin:',
            welcome_compare_tag_denuvo: 'DRM de terceiros: Denuvo Anti-tamper',
            welcome_compare_tag_account: 'Requer conta de terceiros',
            welcome_compare_eula_lead: '"Requer aceitação de contrato de terceiros / EULA" (exemplo abaixo) normalmente não é um problema.',
            welcome_compare_eula_body: 'Na maioria dos casos, isso é só um aviso de contrato/licença do jogo.',
            welcome_compare_eula_tag: "Requer aceitação de contrato de terceiros<br>Assassin's Creed Shadows EULA",

            welcome_summary_title: 'Resumo rápido',
            welcome_summary_intro: 'Antes de adicionar um jogo, lembre disso:',
            welcome_summary_row_1_q: 'Denuvo ou conta de terceiros?',
            welcome_summary_row_1_a: 'Procure na aba Correções.',
            welcome_summary_row_2_q: 'Não tem correção?',
            welcome_summary_row_2_a: 'Provavelmente não vai funcionar.',
            welcome_summary_row_3_q: 'É 100% online?',
            welcome_summary_row_3_a: 'Provavelmente não vai funcionar.',
            welcome_summary_row_4_q: 'Só tem aviso de EULA?',
            welcome_summary_row_4_a: 'Geralmente funciona.'
        },
        es: {
            welcome_step_label: 'PASO {current} DE {total}',
            welcome_skip: 'Saltar',
            welcome_back: 'Volver',
            welcome_next: 'Siguiente',
            welcome_finish: 'Entendido, continuar',

            welcome_intro_title: 'Bienvenido a Merlin',
            welcome_intro_hint: 'Puedes acceder a este tutorial más tarde desde el menú Ayuda.',

            welcome_rules_title: 'Juegos que normalmente no funcionan',
            welcome_rules_intro: 'Algunos tipos de juegos normalmente no funcionan en Merlin:',
            welcome_rules_item_online_title: 'Juegos 100% online',
            welcome_rules_item_online_text: 'Juegos que dependen totalmente de servidores, inicio de sesión obligatorio o conexión permanente.',
            welcome_rules_item_denuvo_title: 'Juegos con Denuvo / Anti-tamper',
            welcome_rules_item_denuvo_text: 'Si el juego tiene la etiqueta Denuvo Anti-tamper, solo funcionará si existe una corrección disponible para él.',
            welcome_rules_item_launcher_title: 'Juegos con launcher externo obligatorio',
            welcome_rules_item_launcher_text: 'Juegos que requieren cuentas o launchers como Ubisoft Connect, EA App, Rockstar Games Launcher, 2K Account y otros launchers externos obligatorios.',
            welcome_rules_closing: 'Si el juego requiere una cuenta de terceros o vinculación con otro launcher, puede no funcionar sin una corrección específica.',
            welcome_rules_note: 'Importante: los juegos con co-op o multijugador online que también pueden jugarse offline normalmente funcionan en Merlin.',

            welcome_compare_title: '¿Cómo saber si mi juego funcionará?',
            welcome_compare_intro_1: 'En la página del juego, presta atención a los avisos de Steam.',
            welcome_compare_intro_2: 'Si aparece alguno de estos avisos, busca el juego en la pestaña Correcciones de Merlin:',
            welcome_compare_tag_denuvo: 'DRM de terceros: Denuvo Anti-tamper',
            welcome_compare_tag_account: 'Requiere cuenta de terceros',
            welcome_compare_eula_lead: '"Requiere aceptación de contrato de terceros / EULA" (ejemplo abajo) normalmente no es un problema.',
            welcome_compare_eula_body: 'En la mayoría de los casos, esto es solo un aviso de contrato/licencia del juego.',
            welcome_compare_eula_tag: "Requiere aceptación de contrato de terceros<br>Assassin's Creed Shadows EULA",

            welcome_summary_title: 'Resumen rápido',
            welcome_summary_intro: 'Antes de agregar un juego, recuerda esto:',
            welcome_summary_row_1_q: '¿Denuvo o cuenta de terceros?',
            welcome_summary_row_1_a: 'Busca en la pestaña Correcciones.',
            welcome_summary_row_2_q: '¿No hay corrección?',
            welcome_summary_row_2_a: 'Probablemente no funcionará.',
            welcome_summary_row_3_q: '¿Es 100% online?',
            welcome_summary_row_3_a: 'Probablemente no funcionará.',
            welcome_summary_row_4_q: '¿Solo tiene aviso de EULA?',
            welcome_summary_row_4_a: 'Normalmente funciona.'
        },
        fr: {
            welcome_step_label: 'ÉTAPE {current} SUR {total}',
            welcome_skip: 'Passer',
            welcome_back: 'Retour',
            welcome_next: 'Suivant',
            welcome_finish: 'Compris, continuer',

            welcome_intro_title: 'Bienvenue sur Merlin',
            welcome_intro_hint: 'Vous pourrez rouvrir ce tutoriel plus tard depuis le menu Aide.',

            welcome_rules_title: 'Jeux qui ne fonctionnent généralement pas',
            welcome_rules_intro: 'Certains types de jeux ne fonctionnent généralement pas avec Merlin :',
            welcome_rules_item_online_title: 'Jeux 100 % en ligne',
            welcome_rules_item_online_text: 'Jeux qui dépendent entièrement de serveurs, d’une connexion obligatoire ou d’une connexion permanente.',
            welcome_rules_item_denuvo_title: 'Jeux avec Denuvo / Anti-tamper',
            welcome_rules_item_denuvo_text: 'Si le jeu possède l’étiquette Denuvo Anti-tamper, il ne fonctionnera que si une correction est disponible.',
            welcome_rules_item_launcher_title: 'Jeux avec launcher externe obligatoire',
            welcome_rules_item_launcher_text: 'Jeux qui nécessitent des comptes ou des launchers comme Ubisoft Connect, EA App, Rockstar Games Launcher, 2K Account et d’autres launchers externes obligatoires.',
            welcome_rules_closing: 'Si le jeu demande un compte tiers ou un lien avec un autre launcher, il peut ne pas fonctionner sans correction spécifique.',
            welcome_rules_note: 'Important : les jeux avec co-op ou multijoueur en ligne, qui peuvent aussi être joués hors ligne, fonctionnent généralement avec Merlin.',

            welcome_compare_title: 'Comment savoir si mon jeu va fonctionner ?',
            welcome_compare_intro_1: 'Sur la page du jeu, faites attention aux avertissements Steam.',
            welcome_compare_intro_2: 'Si l’un de ces avertissements apparaît, cherchez le jeu dans l’onglet Corrections de Merlin :',
            welcome_compare_tag_denuvo: 'DRM tiers : Denuvo Anti-tamper',
            welcome_compare_tag_account: 'Requiert un compte tiers',
            welcome_compare_eula_lead: '"Requiert l’acceptation d’un contrat tiers / EULA" (exemple ci-dessous) n’est généralement pas un problème.',
            welcome_compare_eula_body: 'Dans la plupart des cas, il s’agit seulement d’un avertissement de contrat/licence du jeu.',
            welcome_compare_eula_tag: "Requiert l’acceptation d’un contrat tiers<br>Assassin's Creed Shadows EULA",

            welcome_summary_title: 'Résumé rapide',
            welcome_summary_intro: 'Avant d’ajouter un jeu, retenez ceci :',
            welcome_summary_row_1_q: 'Denuvo ou compte tiers ?',
            welcome_summary_row_1_a: 'Cherchez dans l’onglet Corrections.',
            welcome_summary_row_2_q: 'Pas de correction ?',
            welcome_summary_row_2_a: 'Il ne fonctionnera probablement pas.',
            welcome_summary_row_3_q: 'Est-il 100 % en ligne ?',
            welcome_summary_row_3_a: 'Il ne fonctionnera probablement pas.',
            welcome_summary_row_4_q: 'Seulement un avertissement EULA ?',
            welcome_summary_row_4_a: 'Il fonctionne généralement.'
        },
        de: {
            welcome_step_label: 'SCHRITT {current} VON {total}',
            welcome_skip: 'Überspringen',
            welcome_back: 'Zurück',
            welcome_next: 'Weiter',
            welcome_finish: 'Verstanden, weiter',

            welcome_intro_title: 'Willkommen bei Merlin',
            welcome_intro_hint: 'Du kannst dieses Tutorial später erneut über das Hilfe-Menü öffnen.',

            welcome_rules_title: 'Spiele, die normalerweise nicht funktionieren',
            welcome_rules_intro: 'Einige Spieltypen funktionieren normalerweise nicht mit Merlin:',
            welcome_rules_item_online_title: '100 % Online-Spiele',
            welcome_rules_item_online_text: 'Spiele, die vollständig von Servern, verpflichtendem Login oder einer dauerhaften Verbindung abhängen.',
            welcome_rules_item_denuvo_title: 'Spiele mit Denuvo / Anti-tamper',
            welcome_rules_item_denuvo_text: 'Wenn das Spiel das Denuvo-Anti-tamper-Tag hat, funktioniert es nur, wenn eine Korrektur dafür verfügbar ist.',
            welcome_rules_item_launcher_title: 'Spiele mit verpflichtendem externem Launcher',
            welcome_rules_item_launcher_text: 'Spiele, die Konten oder Launcher wie Ubisoft Connect, EA App, Rockstar Games Launcher, 2K Account und andere verpflichtende externe Launcher benötigen.',
            welcome_rules_closing: 'Wenn das Spiel ein Drittanbieter-Konto oder die Verknüpfung mit einem anderen Launcher verlangt, funktioniert es möglicherweise nicht ohne eine spezielle Korrektur.',
            welcome_rules_note: 'Wichtig: Spiele mit Koop oder Online-Multiplayer, die auch offline gespielt werden können, funktionieren normalerweise mit Merlin.',

            welcome_compare_title: 'Wie erkenne ich, ob mein Spiel funktioniert?',
            welcome_compare_intro_1: 'Achte auf der Spielseite auf die Hinweise bei Steam.',
            welcome_compare_intro_2: 'Wenn einer dieser Hinweise erscheint, suche das Spiel im Korrekturen-Tab von Merlin:',
            welcome_compare_tag_denuvo: 'DRM von Drittanbietern: Denuvo Anti-tamper',
            welcome_compare_tag_account: 'Drittanbieter-Konto erforderlich',
            welcome_compare_eula_lead: '"Akzeptanz eines Drittanbietervertrags / EULA erforderlich" (Beispiel unten) ist normalerweise kein Problem.',
            welcome_compare_eula_body: 'In den meisten Fällen ist das nur ein Hinweis auf Vertrag/Lizenz des Spiels.',
            welcome_compare_eula_tag: "Akzeptanz eines Drittanbietervertrags erforderlich<br>Assassin's Creed Shadows EULA",

            welcome_summary_title: 'Kurze Zusammenfassung',
            welcome_summary_intro: 'Bevor du ein Spiel hinzufügst, merke dir Folgendes:',
            welcome_summary_row_1_q: 'Denuvo oder Drittanbieter-Konto?',
            welcome_summary_row_1_a: 'Suche im Korrekturen-Tab.',
            welcome_summary_row_2_q: 'Keine Korrektur vorhanden?',
            welcome_summary_row_2_a: 'Es wird wahrscheinlich nicht funktionieren.',
            welcome_summary_row_3_q: 'Ist es 100 % online?',
            welcome_summary_row_3_a: 'Es wird wahrscheinlich nicht funktionieren.',
            welcome_summary_row_4_q: 'Nur ein EULA-Hinweis?',
            welcome_summary_row_4_a: 'Es funktioniert normalerweise.'
        }
    };

    window.merlinI18n?.register?.(messages);

    const steps = [
        {
            variant: 'intro',
            titleKey: 'welcome_intro_title'
        },
        {
            variant: 'rules',
            titleKey: 'welcome_rules_title',
            introKeys: ['welcome_rules_intro'],
            items: [
                { labelKey: 'welcome_rules_item_online_title', textKey: 'welcome_rules_item_online_text' },
                { labelKey: 'welcome_rules_item_denuvo_title', textKey: 'welcome_rules_item_denuvo_text' },
                { labelKey: 'welcome_rules_item_launcher_title', textKey: 'welcome_rules_item_launcher_text' }
            ],
            closingKey: 'welcome_rules_closing',
            noteKey: 'welcome_rules_note'
        },
        {
            variant: 'compare',
            titleKey: 'welcome_compare_title',
            introKeys: ['welcome_compare_intro_1', 'welcome_compare_intro_2'],
            tagKeys: ['welcome_compare_tag_denuvo', 'welcome_compare_tag_account'],
            eulaLeadKey: 'welcome_compare_eula_lead',
            eulaBodyKey: 'welcome_compare_eula_body',
            eulaTagKey: 'welcome_compare_eula_tag'
        },
        {
            variant: 'summary',
            titleKey: 'welcome_summary_title',
            introKeys: ['welcome_summary_intro'],
            rows: [
                ['welcome_summary_row_1_q', 'welcome_summary_row_1_a'],
                ['welcome_summary_row_2_q', 'welcome_summary_row_2_a'],
                ['welcome_summary_row_3_q', 'welcome_summary_row_3_a'],
                ['welcome_summary_row_4_q', 'welcome_summary_row_4_a']
            ]
        }
    ];

    function tr(key) {
        const currentLanguage = window.merlinI18n?.current?.() || 'en';
        return messages[currentLanguage]?.[key] || messages.en?.[key] || key;
    }

    function format(message, values) {
        return message.replace(/\{(\w+)\}/g, (_, token) => String(values[token] ?? ''));
    }

    function renderIntro(step) {
        return `
            <section class="welcome-modal-screen welcome-modal-screen-intro">
                ${renderCopy(step.titleKey, [])}
                <div class="welcome-modal-intro-image-wrap">
                    <img class="welcome-modal-intro-image" src="assets/welcome-step-1.png" alt="">
                </div>
                <p class="welcome-modal-intro-hint">${tr('welcome_intro_hint')}</p>
            </section>
        `;
    }

    function renderRules(step) {
        return `
            <section class="welcome-modal-screen welcome-modal-screen-rules">
                ${renderCopy(step.titleKey, step.introKeys)}
                <div class="welcome-modal-list">
                    ${step.items
                        .map(
                            item => `
                                <div class="welcome-modal-list-item">
                                    <strong>${tr(item.labelKey)}</strong>
                                    <p>${tr(item.textKey)}</p>
                                </div>
                            `
                        )
                        .join('')}
                </div>
                <div class="welcome-modal-closing">
                    <p>${tr(step.closingKey)}</p>
                </div>
                <div class="welcome-modal-note">
                    <p>${tr(step.noteKey)}</p>
                </div>
            </section>
        `;
    }

    function renderCompare(step) {
        return `
            <section class="welcome-modal-screen welcome-modal-screen-compare">
                ${renderCopy(step.titleKey, step.introKeys)}
                <div class="welcome-modal-compare-stack">
                    <div class="welcome-modal-tag-grid welcome-modal-tag-grid-compare" aria-hidden="true">
                        ${step.tagKeys.map(key => `<div class="welcome-modal-tag">${tr(key)}</div>`).join('')}
                    </div>
                    <div class="welcome-modal-eula-note">
                        <p class="welcome-modal-eula-lead">${tr(step.eulaLeadKey)}</p>
                        <p class="welcome-modal-eula-body">${tr(step.eulaBodyKey)}</p>
                        <div class="welcome-modal-tag welcome-modal-tag-eula">${tr(step.eulaTagKey)}</div>
                    </div>
                </div>
            </section>
        `;
    }

    function renderSummary(step) {
        return `
            <section class="welcome-modal-screen welcome-modal-screen-summary">
                ${renderCopy(step.titleKey, step.introKeys)}
                <div class="welcome-modal-summary-table">
                    ${step.rows
                        .map(
                            ([questionKey, answerKey]) => `
                                <div class="welcome-modal-summary-row">
                                    <strong>${tr(questionKey)}</strong>
                                    <span>${tr(answerKey)}</span>
                                </div>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `;
    }

    function renderCopy(titleKey, paragraphKeys) {
        return `
            <div class="welcome-modal-copy">
                <h2 id="welcomeModalTitle">${tr(titleKey)}</h2>
                ${paragraphKeys.map(key => `<p>${tr(key)}</p>`).join('')}
            </div>
        `;
    }

    function renderStepBody(step) {
        switch (step.variant) {
            case 'intro':
                return renderIntro(step);
            case 'rules':
                return renderRules(step);
            case 'compare':
                return renderCompare(step);
            case 'summary':
                return renderSummary(step);
            default:
                return '';
        }
    }

    let currentStep = 0;

    function renderStep() {
        const isFirst = currentStep === 0;
        const isLast = currentStep === steps.length - 1;
        const step = steps[currentStep];

        body.innerHTML = renderStepBody(step);
        modal.dataset.step = String(currentStep + 1);
        stepLabel.textContent = format(tr('welcome_step_label'), {
            current: currentStep + 1,
            total: steps.length
        });
        progressBars.forEach((item, index) => {
            item.hidden = index >= steps.length;
            item.classList.toggle('active', index === currentStep);
        });
        backButton.hidden = isFirst;
        skipButton.hidden = !isFirst;
        backButton.textContent = tr('welcome_back');
        skipButton.textContent = tr('welcome_skip');
        nextButton.textContent = isLast ? tr('welcome_finish') : tr('welcome_next');
    }

    async function closeWizard() {
        modal.hidden = true;
        await window.electronAPI.saveConfig({ tutorialPromptSeen: true });
    }

    function openWizard(stepIndex = 0) {
        currentStep = Math.max(0, Math.min(stepIndex, steps.length - 1));
        renderStep();
        modal.hidden = false;
        nextButton.focus();
    }

    window.openMerlinWelcomeWizard = openWizard;

    backButton.addEventListener('click', () => {
        if (currentStep === 0) return;
        currentStep -= 1;
        renderStep();
    });

    nextButton.addEventListener('click', async () => {
        if (currentStep >= steps.length - 1) {
            await closeWizard();
            return;
        }

        currentStep += 1;
        renderStep();
    });

    skipButton.addEventListener('click', closeWizard);

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !modal.hidden) {
            closeWizard();
        }
    });

    window.addEventListener('DOMContentLoaded', async () => {
        const config = await window.electronAPI.getConfig();
        if (config?.tutorialPromptSeen !== true) {
            openWizard();
        }
    });

    window.addEventListener('merlin-language-changed', () => {
        if (!modal.hidden) renderStep();
    });
})();
