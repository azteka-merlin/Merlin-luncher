const REQUIRED_DLLS = ['LumaCore.dll', 'dwmapi.dll'];

function createSteamService({ fs, path, exec, platform, userProfile }) {
    function getActivationReadiness(steamPath) {
        if (!steamPath || typeof steamPath !== 'string') {
            return { ok: false, reason: 'steam_path_missing', missing: [] };
        }

        const resolvedPath = path.resolve(steamPath);
        if (!fs.existsSync(resolvedPath)
            || !fs.statSync(resolvedPath).isDirectory()
            || !fs.existsSync(path.join(resolvedPath, 'steam.exe'))) {
            return { ok: false, reason: 'steam_path_invalid', missing: [] };
        }

        const missing = REQUIRED_DLLS.filter(dll =>
            !fs.existsSync(path.join(resolvedPath, dll))
        );
        if (missing.length > 0) {
            return { ok: false, reason: 'required_files_missing', missing };
        }

        return { ok: true, reason: null, missing: [] };
    }

    function findDefaultPath() {
        const possiblePaths = [
            'C:\\Program Files (x86)\\Steam',
            'C:\\Program Files\\Steam',
            'D:\\Steam',
            'E:\\Steam',
            path.join(userProfile || '', 'Steam')
        ];

        return possiblePaths.find(steamPath =>
            fs.existsSync(path.join(steamPath, 'steam.exe'))
        ) || null;
    }

    function isRunning() {
        return new Promise(resolve => {
            if (platform === 'win32') {
                exec('tasklist', (error, stdout) => {
                    resolve(!error && stdout.toLowerCase().includes('steam.exe'));
                });
            } else {
                exec('pgrep steam', error => resolve(!error));
            }
        });
    }

    function close(steamPath) {
        return new Promise(resolve => {
            if (platform === 'win32') {
                const steamExe = path.join(steamPath, 'steam.exe');
                exec(`"${steamExe}" -shutdown`, () => {
                    setTimeout(() => {
                        exec('taskkill /F /IM steam.exe', () => resolve(true));
                    }, 3000);
                });
            } else {
                exec('pkill -f steam', error => resolve(!error));
            }
        });
    }

    function start(steamPath) {
        return new Promise(resolve => {
            if (platform === 'win32') {
                exec(`"${path.join(steamPath, 'steam.exe')}"`, error => resolve(!error));
            } else {
                exec('steam', error => resolve(!error));
            }
        });
    }

    function getFilesStatus(steamPath) {
        if (!steamPath || !fs.existsSync(steamPath)) {
            return { ok: false, reason: 'steam_path_missing' };
        }
        const missing = REQUIRED_DLLS.filter(dll =>
            !fs.existsSync(path.join(steamPath, dll))
        );
        return { ok: missing.length === 0 };
    }

    return {
        close,
        findDefaultPath,
        getActivationReadiness,
        getFilesStatus,
        isRunning,
        start
    };
}

module.exports = { REQUIRED_DLLS, createSteamService };
