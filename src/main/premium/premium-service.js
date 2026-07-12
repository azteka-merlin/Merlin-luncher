function createPremiumService({
    app,
    fs,
    path,
    AdmZip,
    shell,
    configStore,
    steamService,
    authSession,
    catalogStore,
    catalogClient,
    downloadManager
}) {
    const { createZipArchiveTools } = require('../files/zip-archive-tools');
    const { spawn } = require('child_process');
    const zipArchiveTools = createZipArchiveTools({ fs, path, AdmZip });
    const operations = new Map();
    let cachedItems = null;
    const THIRD_PARTY_TOKEN_REQ_TIMEOUT_MS = 15000;

    function cloneItem(item) {
        return {
            ...item,
            availability: {
                ...item.availability,
                cooldownEntries: item.availability.cooldownEntries.map(entry => ({ ...entry }))
            },
            viewer: { ...item.viewer }
        };
    }

    function cloneItems(items) {
        return items.map(cloneItem);
    }

    function beginOperation(operationId) {
        operationId = String(operationId || '').trim();
        if (!operationId) return { success: false, code: 'invalid_operation' };
        if (operations.size > 0 && !operations.has(operationId)) {
            return { success: false, code: 'busy' };
        }

        const operation = {
            id: operationId,
            cancelled: false,
            tempPaths: new Set()
        };
        operations.set(operationId, operation);
        return { success: true, operation };
    }

    function finishOperation(operationId) {
        const operation = operations.get(String(operationId || '').trim());
        if (!operation) return;

        for (const tempPath of [...operation.tempPaths].reverse()) {
            try {
                if (fs.existsSync(tempPath)) {
                    fs.rmSync(tempPath, { recursive: true, force: true });
                }
            } catch (error) {
                console.warn('Unable to clean premium temp path:', error.message);
            }
        }

        operations.delete(operation.id);
    }

    function trackTempPath(operation, tempPath) {
        if (!operation || !tempPath) return;
        operation.tempPaths.add(tempPath);
    }

    function cancel(operationId) {
        const operation = operations.get(String(operationId || '').trim());
        if (!operation) return { success: false, code: 'not_found' };
        operation.cancelled = true;
        downloadManager.cancel(operation.id);
        return { success: true };
    }

    function throwIfCancelled(operation) {
        if (!operation?.cancelled) return;
        const error = new Error('Operation cancelled');
        error.code = 'cancelled';
        throw error;
    }

    function isPathInside(rootPath, candidatePath) {
        const resolvedRoot = path.resolve(rootPath);
        const resolvedCandidate = path.resolve(candidatePath);
        return resolvedCandidate === resolvedRoot
            || resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
    }

    function configuredSteamPath() {
        const steamPath = configStore.get().steamPath;
        const readiness = steamService.getActivationReadiness(steamPath);
        if (readiness.reason === 'steam_path_missing' || readiness.reason === 'steam_path_invalid') {
            return { success: false, code: readiness.reason };
        }
        return { success: true, steamPath };
    }

    async function getCatalogAccessToken() {
        if (!authSession?.getAccessToken) {
            throw new Error('Authentication is not available');
        }

        return authSession.getAccessToken();
    }

    async function refresh() {
        try {
            const accessToken = await getCatalogAccessToken();
            const downloaded = await catalogClient.requestCatalog(accessToken);
            catalogStore.replace(downloaded.items, downloaded.syncedAt);
            cachedItems = downloaded.items;
            return { success: true, items: cloneItems(downloaded.items), stale: false };
        } catch (error) {
            const fallbackItems = catalogStore.list();
            if (fallbackItems.length > 0) {
                cachedItems = fallbackItems;
                return {
                    success: true,
                    items: cloneItems(fallbackItems),
                    stale: true,
                    code: 'refresh_failed'
                };
            }

            const code = error?.code === 'missing'
                ? 'auth_required'
                : (error?.response?.status === 401 ? 'auth_required' : 'refresh_failed');
            return { success: false, code, message: error?.message || 'Could not load premium catalog' };
        }
    }

    async function list({ force = false } = {}) {
        if (!force && cachedItems) {
            return { success: true, items: cloneItems(cachedItems), stale: false };
        }

        const storedItems = catalogStore.list();
        if (!force && storedItems.length > 0) {
            cachedItems = storedItems;
            return { success: true, items: cloneItems(storedItems), stale: false };
        }

        return refresh();
    }

    async function findItem(appId) {
        appId = String(appId || '').trim();
        const items = cachedItems || (await list()).items || [];
        return items.find(item => item.appId === appId) || null;
    }

    function emitProgress(onProgress, item, payload) {
        onProgress({
            appId: item.appId,
            gameName: item.gameName,
            imageUrl: item.imageUrl || null,
            ...payload
        });
    }

    function mapActivationError(error) {
        const status = error?.response?.status;
        const detail = typeof error?.response?.data?.error === 'string'
            ? error.response.data.error
            : typeof error?.response?.data?.message === 'string'
                ? error.response.data.message
                : error?.message || '';
        const normalized = detail.toLowerCase();

        if (error?.code === 'missing' || status === 401) {
            return { code: 'auth_required', message: detail };
        }
        if (status === 404) {
            return { code: 'not_found', message: detail };
        }
        if (status === 409 && normalized.includes('cooldown')) {
            return { code: 'cooldown', message: detail };
        }
        if (status === 409 && normalized.includes('slot')) {
            return { code: 'no_slots', message: detail };
        }
        if (status === 409 && normalized.includes('archive')) {
            return { code: 'archive_unavailable', message: detail };
        }
        if (status === 409 && normalized.includes('processed')) {
            return { code: 'processing', message: detail };
        }
        return { code: 'activate_failed', message: detail || 'Premium activation failed' };
    }

    async function activateRemotely(appId) {
        let accessToken = await getCatalogAccessToken();

        try {
            return {
                accessToken,
                payload: await catalogClient.activate({ appId, accessToken })
            };
        } catch (error) {
            if (error?.response?.status !== 401) throw error;
            await authSession.handleUnauthorized();
            accessToken = await getCatalogAccessToken();
            return {
                accessToken,
                payload: await catalogClient.activate({ appId, accessToken })
            };
        }
    }

    async function activateThirdPartyRemotely(appId, tokenReq, accessToken) {
        try {
            return {
                accessToken,
                payload: await catalogClient.activateThirdParty({ appId, tokenReq, accessToken })
            };
        } catch (error) {
            if (error?.response?.status !== 401) throw error;
            await authSession.handleUnauthorized();
            accessToken = await getCatalogAccessToken();
            return {
                accessToken,
                payload: await catalogClient.activateThirdParty({ appId, tokenReq, accessToken })
            };
        }
    }

    function detectPreferredSteamLanguage(settingsDir) {
        const candidateFiles = [];
        const pending = [settingsDir];

        while (pending.length > 0) {
            const current = pending.pop();
            const entries = fs.readdirSync(current, { withFileTypes: true });

            for (const entry of entries) {
                const entryPath = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    pending.push(entryPath);
                    continue;
                }

                const lowerName = entry.name.toLowerCase();
                if (lowerName.includes('supported') && lowerName.includes('language')) {
                    candidateFiles.push(entryPath);
                }
            }
        }

        for (const candidatePath of candidateFiles) {
            try {
                const content = fs.readFileSync(candidatePath, 'utf8').toLowerCase();
                if (/\bbrazilian\b/.test(content)) return 'brazilian';
                if (/\bportuguese\b/.test(content)) return 'portuguese';
            } catch (error) {
                console.warn('Unable to inspect supported languages file:', error.message);
            }
        }

        return null;
    }

    function buildPremiumConfig(configIni, settingsDir) {
        let normalized = String(configIni || '').replace(/\r\n/g, '\n');
        normalized = normalized.replace(/\n*$/, '');
        const preferredLanguage = detectPreferredSteamLanguage(settingsDir);

        if (!preferredLanguage) {
            return `${normalized}\n`;
        }

        const lines = normalized
            .split('\n')
            .filter(line => !/^language\s*=/i.test(line.trim()));

        const languageLine = `language=${preferredLanguage}`;
        let blankLineIndex = -1;
        for (let index = lines.length - 1; index >= 0; index -= 1) {
            if (lines[index].trim() === '') {
                blankLineIndex = index;
                break;
            }
        }

        if (blankLineIndex >= 0) {
            lines[blankLineIndex] = languageLine;
            return `${lines.join('\n')}\n`;
        }

        lines.push(languageLine);
        return `${lines.join('\n')}\n`;
    }

    function writePremiumConfig(extractedRoot, configIni) {
        const steamSettingsDirs = [];
        const pending = [extractedRoot];

        while (pending.length > 0) {
            const current = pending.pop();
            const entries = fs.readdirSync(current, { withFileTypes: true });

            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                const entryPath = path.join(current, entry.name);
                if (!isPathInside(extractedRoot, entryPath)) continue;

                if (entry.name.toLowerCase() === 'steam_settings') {
                    steamSettingsDirs.push(entryPath);
                }
                pending.push(entryPath);
            }
        }

        if (steamSettingsDirs.length === 0) {
            const fallbackDir = path.join(extractedRoot, 'steam_settings');
            fs.mkdirSync(fallbackDir, { recursive: true });
            steamSettingsDirs.push(fallbackDir);
        }

        for (const settingsDir of steamSettingsDirs) {
            const targetPath = path.join(settingsDir, 'configs.user.ini');
            if (!isPathInside(extractedRoot, targetPath)) {
                const error = new Error(`Blocked config path: ${targetPath}`);
                error.code = 'apply_failed';
                throw error;
            }
            fs.writeFileSync(targetPath, buildPremiumConfig(configIni, settingsDir), 'utf8');
        }
    }

    function copyDirectoryContents(sourceRoot, destinationRoot, operation) {
        const pending = [sourceRoot];

        while (pending.length > 0) {
            throwIfCancelled(operation);
            const current = pending.pop();
            const entries = fs.readdirSync(current, { withFileTypes: true });

            for (const entry of entries) {
                throwIfCancelled(operation);
                const sourcePath = path.join(current, entry.name);
                const relativePath = path.relative(sourceRoot, sourcePath);
                const destinationPath = path.resolve(destinationRoot, relativePath);

                if (!isPathInside(destinationRoot, destinationPath)) {
                    const error = new Error(`Blocked destination path: ${relativePath}`);
                    error.code = 'apply_failed';
                    throw error;
                }

                if (entry.isDirectory()) {
                    fs.mkdirSync(destinationPath, { recursive: true });
                    pending.push(sourcePath);
                    continue;
                }

                fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
                fs.copyFileSync(sourcePath, destinationPath);
            }
        }
    }

    function resolveInstallDestination(gamePath, installSubpath) {
        const normalizedSubpath = String(installSubpath || '').trim();
        if (!normalizedSubpath) {
            return gamePath;
        }

        const slashNormalized = normalizedSubpath.replace(/\//g, path.sep).replace(/\\/g, path.sep);
        const destinationPath = path.resolve(gamePath, slashNormalized);
        if (!isPathInside(gamePath, destinationPath)) {
            const error = new Error(`Blocked install subpath: ${normalizedSubpath}`);
            error.code = 'apply_failed';
            throw error;
        }

        fs.mkdirSync(destinationPath, { recursive: true });
        return destinationPath;
    }

    function resolveLaunchExecutable(gamePath, launchExecutablePath) {
        const rawValue = String(launchExecutablePath || '').trim();
        const normalized = rawValue.replace(/\//g, path.sep).replace(/\\/g, path.sep);
        const segments = normalized.split(path.sep).filter(Boolean);
        const hasUnsafeSegment = segments.some(segment => segment === '.' || segment === '..');
        if (!normalized || path.isAbsolute(normalized) || !/\.exe$/i.test(normalized) || hasUnsafeSegment) {
            const error = new Error('Invalid premium activation executable');
            error.code = 'activate_failed';
            throw error;
        }

        const executablePath = path.resolve(gamePath, normalized);
        if (!isPathInside(gamePath, executablePath)) {
            const error = new Error(`Blocked premium executable path: ${rawValue}`);
            error.code = 'activate_failed';
            throw error;
        }

        if (!fs.existsSync(executablePath)) {
            const error = new Error(`Premium executable not found: ${rawValue}`);
            error.code = 'activate_failed';
            throw error;
        }

        return executablePath;
    }

    function launchPremiumExecutable(executablePath) {
        const child = spawn(executablePath, [], {
            cwd: path.dirname(executablePath),
            stdio: 'ignore',
            windowsHide: true
        });
        child.once('error', error => {
            console.warn('Unable to start premium validation process:', error.message);
        });
        return child;
    }

    function stopPremiumExecutable(child) {
        if (!child || child.killed || !child.pid) return;
        try {
            child.kill();
        } catch (error) {
            console.warn('Unable to stop premium validation process:', error.message);
        }
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function removeFileIfExists(filePath, warningLabel) {
        try {
            if (fs.existsSync(filePath)) {
                fs.rmSync(filePath, { force: true });
            }
        } catch (error) {
            console.warn(`Unable to reset ${warningLabel}:`, error.message);
        }
    }

    async function waitForThirdPartyRequest(executablePath, operation) {
        const executableDir = path.dirname(executablePath);
        const requestPath = path.join(executableDir, 'token_req.txt');
        const tokenPath = path.join(executableDir, 'token.ini');
        removeFileIfExists(requestPath, 'premium request file');
        removeFileIfExists(tokenPath, 'premium token file');

        const child = launchPremiumExecutable(executablePath);

        try {
            const deadline = Date.now() + THIRD_PARTY_TOKEN_REQ_TIMEOUT_MS;
            while (Date.now() < deadline) {
                throwIfCancelled(operation);
                if (fs.existsSync(requestPath)) {
                    const content = fs.readFileSync(requestPath, 'utf8').trim();
                    if (content) {
                        return content;
                    }
                }
                await wait(100);
            }

            const error = new Error('Premium activation request timed out');
            error.code = 'activate_failed';
            throw error;
        } finally {
            stopPremiumExecutable(child);
        }
    }

    function writeThirdPartyTokenIni(executablePath, activationPayload) {
        const token = String(activationPayload || '').trim();
        if (!token) {
            const error = new Error('Invalid premium activation payload');
            error.code = 'activate_failed';
            throw error;
        }

        const targetPath = path.join(path.dirname(executablePath), 'token.ini');
        fs.writeFileSync(targetPath, `[token]\ntoken=${token}\n`, 'utf8');
    }

    async function activate(appId, operationId, onProgress = () => {}) {
        const start = beginOperation(operationId);
        if (!start.success) return start;
        const { operation } = start;

        try {
            const item = await findItem(appId);
            if (!item) {
                return { success: false, code: 'not_found' };
            }

            const steam = configuredSteamPath();
            if (!steam.success) return steam;

            const installation = steamService.findInstalledGame(item.appId, steam.steamPath);
            if (!installation.installed) {
                return {
                    success: false,
                    code: installation.code === 'not_installed'
                        ? 'game_not_installed'
                        : installation.code
                };
            }

            emitProgress(onProgress, item, {
                operationId: operation.id,
                stage: 'preparing',
                percent: 4
            });

            let activationResult;
            try {
                emitProgress(onProgress, item, {
                    operationId: operation.id,
                    stage: 'activating',
                    percent: 12
                });
                activationResult = await activateRemotely(item.appId);
            } catch (error) {
                const mapped = mapActivationError(error);
                return {
                    success: false,
                    code: mapped.code,
                    message: mapped.message
                };
            }

            throwIfCancelled(operation);

            const activation = activationResult?.payload?.activation;
            const activationType = activationResult?.payload?.activationType || item.activationType || 'steam_ticket';
            const isThirdParty = activationType === 'third_party';
            if (!activation?.archiveDownloadUrl) {
                return { success: false, code: 'activate_failed', message: 'Invalid premium activation payload' };
            }
            if (!isThirdParty && !activation.configIni) {
                return { success: false, code: 'activate_failed', message: 'Invalid premium activation payload' };
            }
            if (isThirdParty && !(activation.launchExecutablePath || item.launchExecutablePath)) {
                return { success: false, code: 'activate_failed', message: 'Invalid premium activation payload' };
            }

            const tempRoot = path.join(app.getPath('temp'), 'merlin-premium', operation.id);
            const archivePath = path.join(tempRoot, `${item.appId}.zip`);
            const extractedPath = path.join(tempRoot, 'extracted');
            trackTempPath(operation, tempRoot);
            fs.mkdirSync(extractedPath, { recursive: true });

            const downloadResult = await downloadManager.download({
                operationId: operation.id,
                url: activation.archiveDownloadUrl,
                destinationPath: archivePath,
                headers: {
                    Authorization: `Bearer ${activationResult.accessToken}`
                },
                timeout: 120000,
                onProgress: progress => {
                    emitProgress(onProgress, item, {
                        ...progress,
                        stage: 'downloading',
                        percent: 16 + Math.round((progress.percent || 0) * 0.48)
                    });
                }
            });

            if (!downloadResult.success) {
                return downloadResult;
            }

            throwIfCancelled(operation);
            emitProgress(onProgress, item, {
                operationId: operation.id,
                stage: 'validating',
                percent: 68
            });
            zipArchiveTools.validate(archivePath);

            throwIfCancelled(operation);
            emitProgress(onProgress, item, {
                operationId: operation.id,
                stage: 'extracting',
                percent: 78
            });
            zipArchiveTools.extract(archivePath, extractedPath);

            if (!isThirdParty) {
                throwIfCancelled(operation);
                emitProgress(onProgress, item, {
                    operationId: operation.id,
                    stage: 'writing_config',
                    percent: 88
                });
                writePremiumConfig(extractedPath, activation.configIni);
            }

            throwIfCancelled(operation);
            emitProgress(onProgress, item, {
                operationId: operation.id,
                stage: 'applying',
                percent: isThirdParty ? 86 : 95
            });
            const installDestination = resolveInstallDestination(
                installation.gamePath,
                item.installSubpath
            );
            copyDirectoryContents(extractedPath, installDestination, operation);

            let thirdPartyResult = null;
            if (isThirdParty) {
                throwIfCancelled(operation);
                const executablePath = resolveLaunchExecutable(
                    installation.gamePath,
                    activation.launchExecutablePath || item.launchExecutablePath
                );

                emitProgress(onProgress, item, {
                    operationId: operation.id,
                    stage: 'starting_validation',
                    percent: 90
                });
                const tokenReq = await waitForThirdPartyRequest(executablePath, operation);

                throwIfCancelled(operation);
                emitProgress(onProgress, item, {
                    operationId: operation.id,
                    stage: 'confirming_authorization',
                    percent: 96
                });
                try {
                    thirdPartyResult = await activateThirdPartyRemotely(
                        item.appId,
                        tokenReq,
                        activationResult.accessToken
                    );
                } catch (error) {
                    const mapped = mapActivationError(error);
                    return {
                        success: false,
                        code: mapped.code,
                        message: mapped.message
                    };
                }

                const activationPayload = thirdPartyResult?.payload?.activation?.activationPayload;
                writeThirdPartyTokenIni(executablePath, activationPayload);
            }

            emitProgress(onProgress, item, {
                operationId: operation.id,
                stage: 'cleaning',
                percent: 98
            });

            emitProgress(onProgress, item, {
                operationId: operation.id,
                stage: 'completed',
                percent: 100
            });

            cachedItems = null;

            return {
                success: true,
                appId: item.appId,
                gameName: item.gameName,
                gamePath: installation.gamePath,
                cooldownUntil: activationResult.payload.cooldownUntil || null,
                activationType,
                launchExecutablePath: activation.launchExecutablePath || item.launchExecutablePath || null
            };
        } catch (error) {
            if (error.code === 'cancelled') {
                return { success: false, code: 'cancelled' };
            }
            return {
                success: false,
                code: error.code || 'apply_failed',
                message: error.message
            };
        } finally {
            finishOperation(operationId);
        }
    }

    async function openGameFolder(appId) {
        const steam = configuredSteamPath();
        if (!steam.success) return steam;

        const installation = steamService.findInstalledGame(appId, steam.steamPath);
        if (!installation.installed) {
            return {
                success: false,
                code: installation.code === 'not_installed'
                    ? 'game_not_installed'
                    : installation.code
            };
        }

        const errorMessage = await shell.openPath(installation.gamePath);
        return {
            success: !errorMessage,
            code: errorMessage ? 'open_failed' : null
        };
    }

    return {
        activate,
        cancel,
        list,
        openGameFolder,
        refresh
    };
}

module.exports = { createPremiumService };
