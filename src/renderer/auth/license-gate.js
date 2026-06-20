const licenseGateTranslations = {
    ptbr: {
        eyebrow: 'ACESSO MERLIN',
        title: 'Ative sua licença',
        description: 'Informe sua chave para validar este computador e liberar o aplicativo.',
        label: 'Chave de acesso',
        checking: 'Validando acesso salvo...',
        submit: 'Validar chave',
        validating: 'Validando licença...',
        privacy: 'A chave fica protegida neste computador.',
        invalid_key: 'A chave informada não é válida.',
        expired: 'Esta licença expirou. Fale com o administrador para renovar.',
        revoked: 'Esta licença foi revogada.',
        hwid_mismatch: 'Esta chave já está vinculada a outro computador.',
        unavailable: 'Não foi possível conectar à Merlin API. Tente novamente.',
        server_error: 'A API não conseguiu validar sua licença. Tente novamente.',
        invalid_response: 'A API retornou uma sessão inválida. Tente novamente.',
        device_error: 'Não foi possível identificar este computador.',
        missing: 'Informe sua chave para continuar.'
    },
    en: {
        eyebrow: 'MERLIN ACCESS', title: 'Activate your license',
        description: 'Enter your key to validate this computer and unlock the application.',
        label: 'Access key', checking: 'Validating saved access...', submit: 'Validate key',
        validating: 'Validating license...', privacy: 'Your key is protected on this computer.',
        invalid_key: 'The key you entered is invalid.', expired: 'This license has expired. Contact the administrator to renew it.',
        revoked: 'This license has been revoked.', hwid_mismatch: 'This key is already linked to another computer.',
        unavailable: 'Could not connect to the Merlin API. Try again.', server_error: 'The API could not validate your license. Try again.',
        invalid_response: 'The API returned an invalid session. Try again.', device_error: 'This computer could not be identified.', missing: 'Enter your key to continue.'
    },
    es: {
        eyebrow: 'ACCESO MERLIN', title: 'Activa tu licencia',
        description: 'Introduce tu clave para validar este equipo y desbloquear la aplicación.',
        label: 'Clave de acceso', checking: 'Validando el acceso guardado...', submit: 'Validar clave',
        validating: 'Validando licencia...', privacy: 'Tu clave está protegida en este equipo.',
        invalid_key: 'La clave introducida no es válida.', expired: 'Esta licencia ha caducado. Contacta al administrador para renovarla.',
        revoked: 'Esta licencia ha sido revocada.', hwid_mismatch: 'Esta clave ya está vinculada a otro equipo.',
        unavailable: 'No se pudo conectar con Merlin API. Inténtalo de nuevo.', server_error: 'La API no pudo validar tu licencia.',
        invalid_response: 'La API devolvió una sesión no válida.', device_error: 'No se pudo identificar este equipo.', missing: 'Introduce tu clave para continuar.'
    },
    fr: {
        eyebrow: 'ACCÈS MERLIN', title: 'Activez votre licence',
        description: 'Saisissez votre clé pour valider cet ordinateur et déverrouiller l’application.',
        label: 'Clé d’accès', checking: 'Validation de l’accès enregistré...', submit: 'Valider la clé',
        validating: 'Validation de la licence...', privacy: 'Votre clé est protégée sur cet ordinateur.',
        invalid_key: 'La clé saisie est invalide.', expired: 'Cette licence a expiré. Contactez l’administrateur pour la renouveler.',
        revoked: 'Cette licence a été révoquée.', hwid_mismatch: 'Cette clé est déjà liée à un autre ordinateur.',
        unavailable: 'Connexion à Merlin API impossible. Réessayez.', server_error: 'L’API n’a pas pu valider votre licence.',
        invalid_response: 'L’API a renvoyé une session invalide.', device_error: 'Impossible d’identifier cet ordinateur.', missing: 'Saisissez votre clé pour continuer.'
    },
    de: {
        eyebrow: 'MERLIN-ZUGANG', title: 'Lizenz aktivieren',
        description: 'Geben Sie Ihren Schlüssel ein, um diesen Computer zu validieren und die Anwendung freizuschalten.',
        label: 'Zugangsschlüssel', checking: 'Gespeicherten Zugang validieren...', submit: 'Schlüssel validieren',
        validating: 'Lizenz wird validiert...', privacy: 'Ihr Schlüssel ist auf diesem Computer geschützt.',
        invalid_key: 'Der eingegebene Schlüssel ist ungültig.', expired: 'Diese Lizenz ist abgelaufen. Wenden Sie sich zur Verlängerung an den Administrator.',
        revoked: 'Diese Lizenz wurde widerrufen.', hwid_mismatch: 'Dieser Schlüssel ist bereits mit einem anderen Computer verknüpft.',
        unavailable: 'Verbindung zur Merlin API fehlgeschlagen. Versuchen Sie es erneut.', server_error: 'Die API konnte Ihre Lizenz nicht validieren.',
        invalid_response: 'Die API hat eine ungültige Sitzung zurückgegeben.', device_error: 'Dieser Computer konnte nicht identifiziert werden.', missing: 'Geben Sie Ihren Schlüssel ein, um fortzufahren.'
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const gate = document.getElementById('licenseGate');
    const form = document.getElementById('licenseGateForm');
    const input = document.getElementById('licenseKeyInput');
    const submit = document.getElementById('licenseGateSubmit');
    const feedback = document.getElementById('licenseGateFeedback');
    let language = 'ptbr';
    let busy = true;

    function setApplicationLocked(locked) {
        for (const element of document.body.children) {
            if (element !== gate && element.tagName !== 'SCRIPT') element.inert = locked;
        }
    }

    function messages() {
        return licenseGateTranslations[language] || licenseGateTranslations.ptbr;
    }

    function renderLanguage() {
        const text = messages();
        document.getElementById('licenseGateEyebrow').textContent = text.eyebrow;
        document.getElementById('licenseGateTitle').textContent = text.title;
        document.getElementById('licenseGateDescription').textContent = text.description;
        document.getElementById('licenseGateLabel').textContent = text.label;
        document.getElementById('licenseGateSubmitText').textContent = text.submit;
        document.getElementById('licenseGatePrivacy').textContent = text.privacy;
    }

    async function loadLanguage() {
        try {
            const config = await window.electronAPI.getConfig();
            language = config.language || 'ptbr';
        } catch (_) {
            language = 'ptbr';
        }
        renderLanguage();
    }

    function formatLicenseKey(value) {
        let compact = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (compact.startsWith('MERLIN')) compact = compact.slice(6);
        compact = compact.slice(0, 12);
        const groups = compact.match(/.{1,4}/g) || [];
        return `MERLIN${groups.length ? `-${groups.join('-')}` : '-'}`;
    }

    function isCompleteKey(value) {
        return /^MERLIN-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(value);
    }

    function setBusy(value, message) {
        busy = value;
        gate.classList.toggle('is-busy', value);
        input.disabled = value;
        submit.disabled = value || !isCompleteKey(input.value);
        feedback.dataset.type = value ? 'info' : feedback.dataset.type;
        if (message) feedback.textContent = message;
    }

    function showError(code) {
        setApplicationLocked(true);
        gate.hidden = false;
        gate.classList.remove('is-authenticated');
        const text = messages();
        feedback.textContent = text[code] || text.server_error;
        feedback.dataset.type = 'error';
        setBusy(false);
        input.focus();
    }

    function unlock() {
        gate.classList.add('is-authenticated');
        setApplicationLocked(false);
        setTimeout(() => {
            gate.hidden = true;
        }, 260);
    }

    input.addEventListener('input', () => {
        const cursorAtEnd = input.selectionStart === input.value.length;
        input.value = formatLicenseKey(input.value);
        if (cursorAtEnd) input.setSelectionRange(input.value.length, input.value.length);
        submit.disabled = busy || !isCompleteKey(input.value);
        feedback.textContent = messages().missing;
        feedback.dataset.type = 'info';
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || !isCompleteKey(input.value)) return;

        setBusy(true, messages().validating);
        try {
            const result = await window.electronAPI.auth.login(input.value);
            if (result.authenticated) {
                input.value = '';
                unlock();
                return;
            }
            showError(result.code);
        } catch (_) {
            showError('unavailable');
        }
    });

    window.electronAPI.auth.onRequired(data => showError(data?.code || 'invalid_key'));
    window.addEventListener('merlin-language-changed', loadLanguage);

    setApplicationLocked(true);
    (async () => {
        await loadLanguage();
        feedback.textContent = messages().checking;
        try {
            const result = await window.electronAPI.auth.status();
            if (result.authenticated) {
                unlock();
                return;
            }
            showError(result.code);
        } catch (_) {
            showError('unavailable');
        }
    })();
});
