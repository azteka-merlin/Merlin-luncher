const {
    extractManifestReferences,
    manifestFileName,
    referenceKey
} = require('./manifest-references');

function createLibraryService({ fs, path, configStore, nameStore, nameResolver, steamService }) {
    let cachedItems = null;

    function invalidate() {
        cachedItems = null;
    }

    function steamPaths() {
        const steamPath = configStore.get().steamPath;
        if (!steamPath || typeof steamPath !== 'string') {
            return { success: false, code: 'steam_path_missing' };
        }
        const root = path.resolve(steamPath);
        if (!fs.existsSync(root) || !fs.existsSync(path.join(root, 'steam.exe'))) {
            return { success: false, code: 'steam_path_invalid' };
        }
        return {
            success: true,
            steamPath: root,
            luaDirectory: path.join(root, 'config', 'stplug-in'),
            manifestDirectory: path.join(root, 'depotcache')
        };
    }

    function managedLuaFiles(luaDirectory) {
        if (!fs.existsSync(luaDirectory)) return [];
        return fs.readdirSync(luaDirectory, { withFileTypes: true })
            .filter(entry => entry.isFile() && /^\d+\.lua$/i.test(entry.name))
            .map(entry => ({
                appId: entry.name.replace(/\.lua$/i, ''),
                filePath: path.join(luaDirectory, entry.name)
            }));
    }

    async function buildItems(paths) {
        const luaFiles = managedLuaFiles(paths.luaDirectory);
        const resolvedNames = {};

        for (const file of luaFiles) {
            if (nameStore.get(file.appId)) continue;
            const name = await nameResolver.resolve(file.appId);
            if (name) resolvedNames[file.appId] = name;
        }
        nameStore.setMany(resolvedNames);

        return luaFiles
            .map(file => ({
                appId: file.appId,
                gameName: nameStore.get(file.appId) || ''
            }))
            .sort((left, right) =>
                (left.gameName || left.appId).localeCompare(right.gameName || right.appId));
    }

    async function list({ force = false } = {}) {
        try {
            const paths = steamPaths();
            if (!paths.success) return paths;
            if (!force && cachedItems) {
                return { success: true, items: cachedItems.map(item => ({ ...item })) };
            }
            cachedItems = await buildItems(paths);
            return { success: true, items: cachedItems.map(item => ({ ...item })) };
        } catch (error) {
            console.error('Unable to load Library:', error);
            return { success: false, code: 'load_failed' };
        }
    }

    function recordName(appId, gameName) {
        nameStore.set(String(appId), gameName);
        invalidate();
    }

    function collectSharedReferences(luaFiles, targetAppId) {
        const shared = new Set();
        let scanComplete = true;
        for (const file of luaFiles) {
            if (file.appId === targetAppId) continue;
            try {
                const content = fs.readFileSync(file.filePath, 'utf8');
                for (const reference of extractManifestReferences(content)) {
                    shared.add(referenceKey(reference));
                }
            } catch (error) {
                scanComplete = false;
                console.warn(`Unable to inspect ${file.filePath}:`, error.message);
            }
        }
        return { scanComplete, shared };
    }

    function stageAndDelete(filePaths) {
        const token = `${process.pid}-${Date.now()}`;
        const staged = [];
        try {
            for (const filePath of filePaths) {
                const stagedPath = `${filePath}.merlin-remove-${token}`;
                fs.renameSync(filePath, stagedPath);
                staged.push({ filePath, stagedPath });
            }
        } catch (error) {
            for (const entry of staged.reverse()) {
                try {
                    fs.renameSync(entry.stagedPath, entry.filePath);
                } catch (rollbackError) {
                    console.error('Library removal rollback failed:', rollbackError);
                }
            }
            throw error;
        }

        for (const entry of staged) {
            fs.rmSync(entry.stagedPath, { force: true });
        }
    }

    async function remove(appId) {
        appId = String(appId || '').trim();
        if (!/^\d+$/.test(appId)) return { success: false, code: 'invalid_app_id' };

        try {
            const paths = steamPaths();
            if (!paths.success) return paths;
            const luaFiles = managedLuaFiles(paths.luaDirectory);
            const target = luaFiles.find(file => file.appId === appId);
            if (!target) return { success: false, code: 'not_found' };

            const content = fs.readFileSync(target.filePath, 'utf8');
            const references = extractManifestReferences(content);
            const { scanComplete, shared } = collectSharedReferences(luaFiles, appId);
            const manifests = scanComplete
                ? references
                    .filter(reference => !shared.has(referenceKey(reference)))
                    .map(reference => path.join(paths.manifestDirectory, manifestFileName(reference)))
                    .filter(filePath => fs.existsSync(filePath))
                : [];

            stageAndDelete([target.filePath, ...new Set(manifests)]);
            if (cachedItems) {
                cachedItems = cachedItems.filter(item => item.appId !== appId);
            }

            return {
                success: true,
                appId,
                removedManifests: manifests.length,
                preservedSharedManifests: references.length - manifests.length,
                steamRunning: await steamService.isRunning()
            };
        } catch (error) {
            console.error(`Unable to remove ${appId} from Library:`, error);
            return { success: false, code: 'remove_failed' };
        }
    }

    async function restartSteam() {
        const paths = steamPaths();
        if (!paths.success) return paths;
        await steamService.close(paths.steamPath);
        await new Promise(resolve => setTimeout(resolve, 3000));
        const success = await steamService.start(paths.steamPath);
        return { success, code: success ? null : 'restart_failed' };
    }

    return { invalidate, list, recordName, remove, restartSteam };
}

module.exports = { createLibraryService };
