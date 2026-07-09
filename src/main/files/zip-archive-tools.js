const { execFileSync } = require('child_process');

function isPathInside(rootPath, candidatePath, pathApi) {
    const resolvedRoot = pathApi.resolve(rootPath);
    const resolvedCandidate = pathApi.resolve(candidatePath);
    return resolvedCandidate === resolvedRoot
        || resolvedCandidate.startsWith(`${resolvedRoot}${pathApi.sep}`);
}

function resolveEntryDestination(rootPath, entryName, pathApi) {
    const normalizedName = String(entryName || '').replace(/\\/g, '/');
    const safeEntryName = normalizedName.startsWith('/')
        ? normalizedName.slice(1)
        : normalizedName;
    const destinationPath = pathApi.resolve(rootPath, safeEntryName);

    if (!isPathInside(rootPath, destinationPath, pathApi)) {
        const error = new Error(`Blocked archive path: ${normalizedName}`);
        error.code = 'invalid_zip';
        throw error;
    }

    return destinationPath;
}

function parse7ZipListOutput(output, archiveFilePath) {
    const archivePath = String(archiveFilePath || '').trim().toLowerCase();
    const entries = [];
    let current = null;

    function commitCurrent() {
        if (!current?.path || typeof current.isDirectory !== 'boolean') return;
        const entryPath = current.path.trim();
        if (!entryPath) return;
        if (entryPath.toLowerCase() === archivePath) return;
        entries.push({
            entryName: entryPath,
            isDirectory: current.isDirectory
        });
    }

    for (const rawLine of String(output || '').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;

        if (line.startsWith('Path = ')) {
            commitCurrent();
            current = {
                path: line.slice('Path = '.length),
                isDirectory: null
            };
            continue;
        }

        if (!current) continue;
        if (line === 'Folder = +') {
            current.isDirectory = true;
            continue;
        }
        if (line === 'Folder = -') {
            current.isDirectory = false;
        }
    }

    commitCurrent();
    return entries;
}

function createZipArchiveTools({
    fs,
    path,
    AdmZip
}) {
    function validateEntries(entries) {
        const files = entries.filter(entry => !entry.isDirectory);
        if (files.length === 0) {
            const error = new Error('Empty ZIP archive');
            error.code = 'invalid_zip';
            throw error;
        }
        return files;
    }

    function resolveSevenZipBinary() {
        try {
            const sevenZip = require('7zip-bin');
            return typeof sevenZip?.path7za === 'string' && sevenZip.path7za.trim()
                ? sevenZip.path7za
                : null;
        } catch {
            return null;
        }
    }

    function runSevenZip(args) {
        const binaryPath = resolveSevenZipBinary();
        if (!binaryPath) {
            const error = new Error('7-Zip binary is not available');
            error.code = 'extract_failed';
            throw error;
        }

        try {
            return execFileSync(binaryPath, args, {
                encoding: 'utf8',
                stdio: 'pipe',
                windowsHide: true
            });
        } catch (error) {
            const details = `${String(error.stdout || '')}\n${String(error.stderr || '')}`.trim();
            const message = /wrong password/i.test(details)
                ? 'Encrypted ZIP archive requires a password'
                : details || error.message || '7-Zip extraction failed';
            const wrapped = new Error(message);
            wrapped.code = /wrong password/i.test(details) ? 'encrypted_zip' : 'extract_failed';
            throw wrapped;
        }
    }

    function validateWithAdmZip(archiveFilePath) {
        const zip = new AdmZip(archiveFilePath);
        return {
            method: 'adm-zip',
            files: validateEntries(zip.getEntries())
        };
    }

    function validateWithSevenZip(archiveFilePath) {
        const output = runSevenZip(['l', '-slt', archiveFilePath]);
        return {
            method: '7zip',
            files: validateEntries(parse7ZipListOutput(output, archiveFilePath))
        };
    }

    function validate(archiveFilePath) {
        try {
            return validateWithAdmZip(archiveFilePath);
        } catch (primaryError) {
            try {
                return validateWithSevenZip(archiveFilePath);
            } catch (fallbackError) {
                if (fallbackError.code === 'encrypted_zip') throw fallbackError;
                const wrapped = new Error(primaryError.message || fallbackError.message || 'Invalid ZIP archive');
                wrapped.code = primaryError.code || fallbackError.code || 'invalid_zip';
                throw wrapped;
            }
        }
    }

    function extractWithAdmZip(archiveFilePath, destinationRoot) {
        const zip = new AdmZip(archiveFilePath);
        const entries = zip.getEntries();
        validateEntries(entries);

        for (const entry of entries) {
            const destinationPath = resolveEntryDestination(destinationRoot, entry.entryName, path);
            if (entry.isDirectory) {
                fs.mkdirSync(destinationPath, { recursive: true });
                continue;
            }

            fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
            fs.writeFileSync(destinationPath, entry.getData());
        }

        return { method: 'adm-zip' };
    }

    function extractWithSevenZip(archiveFilePath, destinationRoot) {
        fs.mkdirSync(destinationRoot, { recursive: true });
        runSevenZip(['x', '-y', '-bd', '-bb0', `-o${destinationRoot}`, archiveFilePath]);
        validateExtractedOutput(destinationRoot);
        return { method: '7zip' };
    }

    function validateExtractedOutput(destinationRoot) {
        const pending = [destinationRoot];
        let fileCount = 0;

        while (pending.length > 0) {
            const current = pending.pop();
            const entries = fs.readdirSync(current, { withFileTypes: true });
            for (const entry of entries) {
                const candidatePath = path.join(current, entry.name);
                if (!isPathInside(destinationRoot, candidatePath, path)) {
                    const error = new Error(`Blocked extracted path: ${candidatePath}`);
                    error.code = 'invalid_zip';
                    throw error;
                }

                if (entry.isDirectory()) {
                    pending.push(candidatePath);
                    continue;
                }

                fileCount += 1;
            }
        }

        if (fileCount === 0) {
            const error = new Error('Empty ZIP archive');
            error.code = 'invalid_zip';
            throw error;
        }
    }

    function extract(archiveFilePath, destinationRoot) {
        try {
            return extractWithAdmZip(archiveFilePath, destinationRoot);
        } catch (primaryError) {
            try {
                return extractWithSevenZip(archiveFilePath, destinationRoot);
            } catch (fallbackError) {
                if (fallbackError.code === 'encrypted_zip') throw fallbackError;
                const wrapped = new Error(primaryError.message || fallbackError.message || 'Extraction failed');
                wrapped.code = fallbackError.code || primaryError.code || 'extract_failed';
                throw wrapped;
            }
        }
    }

    return {
        extract,
        validate
    };
}

module.exports = { createZipArchiveTools };
