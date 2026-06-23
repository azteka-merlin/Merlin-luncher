function createCorrectionsService({
    app,
    fs,
    path,
    AdmZip,
    dialog,
    shell,
    configStore,
    steamService,
    catalogStore,
    catalogClient,
    libraryCatalogService,
    downloadManager
}) {
    let cachedItems = null;
    const operations = new Map();

    function fallbackCoverUrl(appId) {
        return /^\d+$/.test(String(appId || '').trim())
            ? `https://generator.ryuu.lol/files/images/${appId}.jpg`
            : null;
    }

    function cloneItem(item) {
        return {
            ...item,
            correction: { ...item.correction }
        };
    }

    function cloneItems(items) {
        return items.map(cloneItem);
    }

    function isPathInside(rootPath, candidatePath) {
        const resolvedRoot = path.resolve(rootPath);
        const resolvedCandidate = path.resolve(candidatePath);
        return resolvedCandidate === resolvedRoot
            || resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
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
                console.warn('Unable to clean correction temp path:', error.message);
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
        if (operation?.cancelled) {
            const error = new Error('Operation cancelled');
            error.code = 'cancelled';
            throw error;
        }
    }

    function emitProgress(onProgress, item, payload) {
        onProgress({
            appId: item.appId,
            gameName: item.gameName,
            fileName: item.correction.filename,
            imageUrl: item.imageUrl || null,
            ...payload
        });
    }

    async function hydrateImages(items) {
        let catalogReady = false;

        try {
            await libraryCatalogService.ensureLoaded();
            catalogReady = true;
        } catch (error) {
            console.warn('Unable to preload game catalog for corrections:', error.message);
        }

        return items.map(item => {
            const catalogEntry = catalogReady
                ? libraryCatalogService.findByAppId(item.appId)
                : null;
            return {
                ...item,
                imageUrl: catalogEntry?.coverUrl || item.imageUrl || fallbackCoverUrl(item.appId) || null
            };
        });
    }

    async function refresh() {
        try {
            const downloaded = await catalogClient.download();
            const hydrated = await hydrateImages(downloaded.items);
            catalogStore.replace(hydrated, downloaded.syncedAt);
            cachedItems = hydrated;
            return { success: true, items: cloneItems(hydrated), stale: false };
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
            return { success: false, code: 'refresh_failed', message: error.message };
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

    async function ensureItemsLoaded() {
        const result = await list();
        return result.success ? result.items : [];
    }

    async function findItem(appId) {
        appId = String(appId || '').trim();
        const items = cachedItems || await ensureItemsLoaded();
        return items.find(item => item.appId === appId) || null;
    }

    function configuredSteamPath() {
        const steamPath = configStore.get().steamPath;
        const readiness = steamService.getActivationReadiness(steamPath);
        if (readiness.reason === 'steam_path_missing' || readiness.reason === 'steam_path_invalid') {
            return { success: false, code: readiness.reason };
        }
        return { success: true, steamPath };
    }

    async function prepareInstall(appId) {
        const item = await findItem(appId);
        if (!item) return { success: false, code: 'not_found' };

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

        return {
            success: true,
            item: cloneItem(item),
            installation
        };
    }

    function validateZipEntries(zip) {
        const entries = zip.getEntries().filter(entry => !entry.isDirectory);
        if (entries.length === 0) {
            const error = new Error('Empty ZIP archive');
            error.code = 'invalid_zip';
            throw error;
        }
        return entries;
    }

    function safeExtractEntry(pathApi, rootPath, entryName) {
        const normalizedName = String(entryName || '').replace(/\\/g, '/');
        const entryPath = normalizedName.startsWith('/')
            ? normalizedName.slice(1)
            : normalizedName;
        const destinationPath = pathApi.resolve(rootPath, entryPath);

        if (!isPathInside(rootPath, destinationPath)) {
            const error = new Error(`Blocked archive path: ${normalizedName}`);
            error.code = 'invalid_zip';
            throw error;
        }

        return destinationPath;
    }

    function extractZipEntries(zip, destinationRoot, operation) {
        const entries = validateZipEntries(zip);

        for (const entry of entries) {
            throwIfCancelled(operation);
            const destinationPath = safeExtractEntry(path, destinationRoot, entry.entryName);
            fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
            fs.writeFileSync(destinationPath, entry.getData());
        }
    }

    function extractNestedZipFiles(rootPath, operation) {
        const pending = [rootPath];
        let extractedNestedCount = 0;
        const maxNestedArchives = 100;

        while (pending.length > 0) {
            throwIfCancelled(operation);
            const current = pending.pop();
            const entries = fs.readdirSync(current, { withFileTypes: true });

            for (const entry of entries) {
                throwIfCancelled(operation);
                const entryPath = path.join(current, entry.name);

                if (entry.isDirectory()) {
                    pending.push(entryPath);
                    continue;
                }

                if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.zip') {
                    continue;
                }

                extractedNestedCount += 1;
                if (extractedNestedCount > maxNestedArchives) {
                    const error = new Error('Too many nested ZIP archives');
                    error.code = 'invalid_zip';
                    throw error;
                }

                const targetDirectory = path.dirname(entryPath);
                const nestedZip = new AdmZip(entryPath);
                extractZipEntries(nestedZip, targetDirectory, operation);
                fs.unlinkSync(entryPath);
                pending.push(targetDirectory);
            }
        }
    }

    function extractZipToDirectory(zipFilePath, destinationRoot, operation) {
        try {
            const zip = new AdmZip(zipFilePath);
            extractZipEntries(zip, destinationRoot, operation);
            extractNestedZipFiles(destinationRoot, operation);
        } catch (error) {
            if (error.code === 'cancelled' || error.code === 'invalid_zip') throw error;
            const wrapped = new Error(error.message || 'Extraction failed');
            wrapped.code = 'extract_failed';
            throw wrapped;
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

    async function performDownload({
        item,
        operation,
        destinationPath,
        onProgress,
        mode
    }) {
        emitProgress(onProgress, item, {
            operationId: operation.id,
            mode,
            stage: 'preparing',
            percent: 2,
            transferredBytes: 0,
            totalBytes: 0,
            speedBytesPerSecond: 0,
            remainingSeconds: null
        });

        const result = await downloadManager.download({
            operationId: operation.id,
            url: item.correction.href,
            destinationPath,
            onProgress: progress => {
                const percent = mode === 'install'
                    ? 8 + Math.round((progress.percent || 0) * 0.52)
                    : 6 + Math.round((progress.percent || 0) * 0.88);
                emitProgress(onProgress, item, {
                    ...progress,
                    mode,
                    percent
                });
            }
        });

        if (!result.success) return result;
        return result;
    }

    async function download(appId, operationId, onProgress = () => {}) {
        const start = beginOperation(operationId);
        if (!start.success) return start;
        const { operation } = start;

        try {
            const item = await findItem(appId);
            if (!item) return { success: false, code: 'not_found' };

            const saveResult = await dialog.showSaveDialog({
                title: item.correction.filename,
                defaultPath: item.correction.filename
            });

            if (saveResult.canceled || !saveResult.filePath) {
                return { success: false, code: 'cancelled' };
            }

            const downloadResult = await performDownload({
                item,
                operation,
                destinationPath: saveResult.filePath,
                onProgress,
                mode: 'download'
            });

            if (!downloadResult.success) return downloadResult;

            emitProgress(onProgress, item, {
                operationId,
                mode: 'download',
                stage: 'completed',
                percent: 100
            });

            return {
                success: true,
                appId: item.appId,
                gameName: item.gameName,
                filePath: downloadResult.filePath,
                folderPath: path.dirname(downloadResult.filePath)
            };
        } finally {
            finishOperation(operationId);
        }
    }

    async function install(appId, operationId, onProgress = () => {}) {
        const start = beginOperation(operationId);
        if (!start.success) return start;
        const { operation } = start;

        try {
            const prepared = await prepareInstall(appId);
            if (!prepared.success) return prepared;

            const item = prepared.item;
            const tempRoot = path.join(app.getPath('temp'), 'merlin-corrections', operation.id);
            const zipPath = path.join(tempRoot, item.correction.filename);
            const extractedPath = path.join(tempRoot, 'extracted');
            trackTempPath(operation, tempRoot);
            fs.mkdirSync(extractedPath, { recursive: true });

            const downloadResult = await performDownload({
                item,
                operation,
                destinationPath: zipPath,
                onProgress,
                mode: 'install'
            });
            if (!downloadResult.success) return downloadResult;

            throwIfCancelled(operation);
            emitProgress(onProgress, item, {
                operationId,
                mode: 'install',
                stage: 'validating',
                percent: 68
            });

            let zip;
            try {
                zip = new AdmZip(zipPath);
                validateZipEntries(zip);
            } catch (error) {
                const wrapped = new Error(error.message || 'Invalid ZIP archive');
                wrapped.code = error.code || 'invalid_zip';
                throw wrapped;
            }

            throwIfCancelled(operation);
            emitProgress(onProgress, item, {
                operationId,
                mode: 'install',
                stage: 'extracting',
                percent: 80
            });
            extractZipToDirectory(zipPath, extractedPath, operation);

            throwIfCancelled(operation);
            emitProgress(onProgress, item, {
                operationId,
                mode: 'install',
                stage: 'applying',
                percent: 92
            });
            copyDirectoryContents(extractedPath, prepared.installation.gamePath, operation);

            emitProgress(onProgress, item, {
                operationId,
                mode: 'install',
                stage: 'cleaning',
                percent: 98
            });

            emitProgress(onProgress, item, {
                operationId,
                mode: 'install',
                stage: 'completed',
                percent: 100
            });

            return {
                success: true,
                appId: item.appId,
                gameName: item.gameName,
                gamePath: prepared.installation.gamePath
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

    async function openFolder(folderPath) {
        const target = String(folderPath || '').trim();
        if (!target) return { success: false, code: 'invalid_path' };
        const errorMessage = await shell.openPath(target);
        return {
            success: !errorMessage,
            code: errorMessage ? 'open_failed' : null
        };
    }

    return {
        cancel,
        download,
        install,
        list,
        openFolder,
        prepareInstall,
        refresh
    };
}

module.exports = { createCorrectionsService };
