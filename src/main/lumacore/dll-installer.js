const MESSAGES = {
    ptbr: {
        msg: 'Arquivos necessários não encontrados. Deseja instalá-los agora?',
        detail: 'Apenas no primeiro uso',
        yes: 'Sim',
        no: 'Não'
    },
    en: {
        msg: 'Required files not found. Would you like to install them now?',
        detail: 'First use only',
        yes: 'Yes',
        no: 'No'
    },
    es: {
        msg: 'Archivos necesarios no encontrados. ¿Desea instalarlos ahora?',
        detail: 'Solo en el primer uso',
        yes: 'Sí',
        no: 'No'
    },
    fr: {
        msg: 'Fichiers requis introuvables. Voulez-vous les installer maintenant ?',
        detail: 'Premier démarrage uniquement',
        yes: 'Oui',
        no: 'Non'
    },
    de: {
        msg: 'Erforderliche Dateien nicht gefunden. Möchten Sie diese jetzt installieren?',
        detail: 'Nur bei der ersten Nutzung',
        yes: 'Ja',
        no: 'Nein'
    }
};

function createDllInstaller({ fs, path, dialog, requiredDlls, getSourcePath, getMainWindow }) {
    function notify(ok) {
        const mainWindow = getMainWindow();
        if (mainWindow?.webContents) {
            mainWindow.webContents.send('files-status', { ok });
        }
    }

    async function checkAndInstall(steamPath, lang = 'en') {
        const message = MESSAGES[lang] || MESSAGES.en;
        const missing = requiredDlls.filter(dll =>
            !fs.existsSync(path.join(steamPath, dll))
        );

        if (missing.length === 0) {
            notify(true);
            return { installed: false, alreadyInstalled: true, cancelled: false };
        }

        const { response } = await dialog.showMessageBox(getMainWindow(), {
            type: 'question',
            buttons: [message.yes, message.no],
            defaultId: 0,
            title: 'Merlin',
            message: message.msg,
            detail: message.detail
        });

        if (response === 0) {
            for (const dll of requiredDlls) {
                const srcPath = getSourcePath(dll);
                if (!fs.existsSync(srcPath)) {
                    throw new Error(`Native DLL build output not found: ${srcPath}`);
                }
            }

            for (const dll of requiredDlls) {
                const srcPath = getSourcePath(dll);
                const destPath = path.join(steamPath, dll);
                fs.copyFileSync(srcPath, destPath);
                console.log(`Installed: ${dll} -> ${destPath}`);
            }

            notify(true);
            return { installed: true, alreadyInstalled: false, cancelled: false };
        }

        notify(false);
        return { installed: false, alreadyInstalled: false, cancelled: true };
    }

    return { checkAndInstall };
}

module.exports = { createDllInstaller };
