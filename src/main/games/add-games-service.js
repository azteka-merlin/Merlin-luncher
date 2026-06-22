const QUEUE_MESSAGES = {
    duplicate: 'Este jogo já está na fila.',
    empty_queue: 'A fila está vazia.',
    install_busy: 'Já existe uma instalação em andamento.',
    queue_not_empty: 'Instalar agora só pode ser usado quando a fila estiver vazia.',
    queue_locked: 'A fila não pode ser alterada durante a instalação.',
    not_found: 'O jogo não está mais na fila.'
};

function friendlyInstallResult(result) {
    if (result.success) return result;

    const prerequisiteMessages = {
        steam_path_missing: 'Configure o caminho da Steam antes de iniciar a instalação.',
        steam_path_invalid: 'O caminho configurado não é uma instalação válida da Steam.',
        required_files_missing: 'Os arquivos obrigatórios não estão instalados. Use Reparar primeiro.'
    };
    if (prerequisiteMessages[result.reason]) {
        return {
            ...result,
            code: result.reason,
            message: prerequisiteMessages[result.reason]
        };
    }

    if (result.reason === 'rate_limited') {
        return {
            ...result,
            code: 'rate_limited',
            message: 'O limite temporário de solicitações desta licença foi atingido. Aguarde alguns instantes e tente novamente.'
        };
    }

    const message = String(result.message || '');
    if (/unable to download/i.test(message)) {
        return {
            ...result,
            code: 'download_unavailable',
            message: 'Não foi possível baixar os arquivos desse jogo.'
        };
    }
    if (/invalid zip|empty zip|archive|no files found|no valid steam files/i.test(message)) {
        return {
            ...result,
            code: 'archive_invalid',
            message: 'Os arquivos recebidos para esse jogo são inválidos ou estão incompletos.'
        };
    }
    return {
        ...result,
        code: 'generic',
        message: 'Não foi possível concluir a instalação desse jogo.'
    };
}

function normalizeSelectedItem(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const appId = String(input.appId || '').trim();
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const coverUrl = typeof input.coverUrl === 'string' ? input.coverUrl.trim() : '';
    if (!/^\d+$/.test(appId) || !name) return null;
    return {
        appId,
        name,
        coverUrl: coverUrl || null,
        autoUpdate: input.autoUpdate !== false
    };
}

function normalizeInputPayload(input) {
    if (typeof input === 'string') {
        return {
            selected: null,
            raw: input,
            autoUpdate: true
        };
    }

    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return {
            selected: null,
            raw: '',
            autoUpdate: true
        };
    }

    const selected = normalizeSelectedItem(input.selected || input.game || null);
    const selectedFromRoot = normalizeSelectedItem(input);
    return {
        selected: selected || selectedFromRoot,
        raw: typeof input.raw === 'string'
            ? input.raw
            : typeof input.input === 'string'
                ? input.input
                : typeof input.link === 'string'
                    ? input.link
                    : '',
        autoUpdate: input.autoUpdate !== false
    };
}

function createAddGamesService({
    parseSteamGameLink,
    nameResolver,
    queue,
    gameInstaller,
    configStore,
    steamService,
    libraryService,
    catalogService
}) {
    let installing = false;

    function queueState() {
        const items = queue.list();
        return { items, count: items.length, locked: queue.isLocked(), installing };
    }

    async function resolveLink(link) {
        try {
            const parsed = parseSteamGameLink(link);
            const catalogMatch = await catalogService?.resolveByAppId(parsed.appId, { allowRefresh: true });
            const name = catalogMatch?.name || await nameResolver.resolve(parsed.appId, parsed.fallbackName);
            return {
                success: true,
                item: {
                    appId: parsed.appId,
                    name,
                    coverUrl: catalogMatch?.coverUrl || null
                }
            };
        } catch (error) {
            return {
                success: false,
                code: error.code || 'resolve_failed',
                message: error.code
                    ? error.message
                    : 'Não foi possível interpretar esse link da Steam.'
            };
        }
    }

    async function resolveCatalogGame(query) {
        const term = String(query || '').trim();
        if (!term) {
            return {
                success: false,
                code: 'selection_required',
                message: 'Selecione um jogo antes de continuar.'
            };
        }
        const match = /^\d+$/.test(term)
            ? await catalogService?.resolveByAppId(term, { allowRefresh: true })
            : null;

        if (!match) {
            return {
                success: false,
                code: 'not_found',
                message: 'Nenhum jogo foi encontrado para essa busca.'
            };
        }

        return { success: true, item: match };
    }

    async function resolveInput(input) {
        const payload = normalizeInputPayload(input);
        if (payload.selected) {
            return {
                success: true,
                item: {
                    ...payload.selected,
                    autoUpdate: payload.autoUpdate
                }
            };
        }
        const raw = String(payload.raw || '').trim();
        if (!raw) {
            return {
                success: false,
                code: 'selection_required',
                message: 'Selecione um jogo antes de continuar.'
            };
        }
        const resolved = /^https?:\/\//i.test(raw)
            ? await resolveLink(raw)
            : await resolveCatalogGame(raw);
        if (!resolved.success) return resolved;
        return {
            ...resolved,
            item: {
                ...resolved.item,
                autoUpdate: payload.autoUpdate
            }
        };
    }

    async function searchCatalog(query) {
        const term = String(query || '').trim();
        if (!term) return { success: true, items: [] };
        try {
            const items = await catalogService.search(term, { limit: 4 });
            return { success: true, items };
        } catch (error) {
            return {
                success: false,
                code: 'search_failed',
                message: error.message || 'Não foi possível pesquisar agora.',
                items: []
            };
        }
    }

    async function add(input, onQueueUpdated = () => {}) {
        const resolved = await resolveInput(input);
        if (!resolved.success) return resolved;

        const result = queue.add(resolved.item);
        if (!result.success) {
            return { ...result, message: QUEUE_MESSAGES[result.code] };
        }

        onQueueUpdated(queueState());
        return { success: true, item: result.item, queue: queueState() };
    }

    function remove(appId, onQueueUpdated = () => {}) {
        const result = queue.remove(String(appId || ''));
        if (!result.success) return { ...result, message: QUEUE_MESSAGES[result.code] };
        onQueueUpdated(queueState());
        return { success: true, queue: queueState() };
    }

    function clear(onQueueUpdated = () => {}) {
        const result = queue.clear();
        if (!result.success) return { ...result, message: QUEUE_MESSAGES[result.code] };
        onQueueUpdated(queueState());
        return { success: true, queue: queueState() };
    }

    async function installNow(input, events = {}) {
        if (installing) {
            return { success: false, code: 'install_busy', message: QUEUE_MESSAGES.install_busy };
        }
        if (queue.list().length > 0) {
            return {
                success: false,
                code: 'queue_not_empty',
                message: QUEUE_MESSAGES.queue_not_empty
            };
        }

        const resolved = await resolveInput(input);
        if (!resolved.success) return resolved;
        if (queue.list().length > 0) {
            return {
                success: false,
                code: 'queue_not_empty',
                message: QUEUE_MESSAGES.queue_not_empty
            };
        }
        if (queue.has(resolved.item.appId)) {
            return { success: false, code: 'duplicate', message: QUEUE_MESSAGES.duplicate };
        }

        const added = queue.add(resolved.item);
        if (!added.success) {
            return { ...added, message: QUEUE_MESSAGES[added.code] };
        }

        installing = true;
        queue.setLocked(true);
        events.queueUpdated?.(queueState());

        try {
            const result = friendlyInstallResult(await gameInstaller.install({
                appId: resolved.item.appId,
                steamPath: configStore.get().steamPath,
                autoUpdate: resolved.item.autoUpdate !== false,
                onProgress: progress => events.progress?.({
                    ...progress,
                    appId: resolved.item.appId,
                    name: resolved.item.name,
                    coverUrl: resolved.item.coverUrl || null,
                    current: 1,
                    total: 1
                })
            }));
            if (result.success) {
                libraryService?.recordName(resolved.item.appId, resolved.item.name);
            }
            return { ...result, item: resolved.item };
        } finally {
            queue.remove(resolved.item.appId, true);
            queue.setLocked(false);
            installing = false;
            events.queueUpdated?.(queueState());
        }
    }

    async function installAll(events = {}) {
        if (installing) {
            return { success: false, code: 'install_busy', message: QUEUE_MESSAGES.install_busy };
        }

        const snapshot = queue.list();
        if (snapshot.length === 0) {
            return { success: false, code: 'empty_queue', message: QUEUE_MESSAGES.empty_queue };
        }

        installing = true;
        queue.setLocked(true);
        events.queueUpdated?.(queueState());
        const installed = [];
        const failed = [];

        try {
            for (let index = 0; index < snapshot.length; index++) {
                const item = snapshot[index];
                const result = friendlyInstallResult(await gameInstaller.install({
                    appId: item.appId,
                    steamPath: configStore.get().steamPath,
                    autoUpdate: item.autoUpdate !== false,
                    onProgress: progress => events.progress?.({
                        ...progress,
                        appId: item.appId,
                        name: item.name,
                        coverUrl: item.coverUrl || null,
                        current: index + 1,
                        total: snapshot.length
                    })
                }));

                if (result.success) {
                    libraryService?.recordName(item.appId, item.name);
                    installed.push(item);
                    queue.remove(item.appId, true);
                    events.queueUpdated?.(queueState());
                } else {
                    failed.push({ ...item, error: result.message });
                }
            }

            return { success: failed.length === 0, installed, failed };
        } finally {
            queue.setLocked(false);
            installing = false;
            events.queueUpdated?.(queueState());
        }
    }

    async function restartSteam() {
        const steamPath = configStore.get().steamPath;
        const readiness = steamService.getActivationReadiness(steamPath);
        if (!readiness.ok) {
            return {
                success: false,
                code: readiness.reason,
                message: 'A instalação da Steam não está pronta para ser reiniciada.'
            };
        }

        await steamService.close(steamPath);
        await new Promise(resolve => setTimeout(resolve, 3000));
        const started = await steamService.start(steamPath);
        return {
            success: started,
            message: started ? 'Steam reiniciada.' : 'Não foi possível iniciar a Steam.'
        };
    }

    return {
        add,
        clear,
        installAll,
        installNow,
        queueState,
        remove,
        resolveInput,
        resolveLink,
        restartSteam,
        searchCatalog
    };
}

module.exports = { createAddGamesService };
