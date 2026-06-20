function extractManifestReferences(content) {
    const references = [];
    const seen = new Set();
    const pattern = /^\s*(?:--\s*)?setmanifestid\s*\(\s*(\d+)\s*,\s*["']?(\d+)["']?\s*\)/gmi;
    let match;

    while ((match = pattern.exec(String(content || ''))) !== null) {
        const reference = { depotId: match[1], manifestId: match[2] };
        const key = `${reference.depotId}:${reference.manifestId}`;
        if (!seen.has(key)) {
            seen.add(key);
            references.push(reference);
        }
    }
    return references;
}

function referenceKey(reference) {
    return `${reference.depotId}:${reference.manifestId}`;
}

function manifestFileName(reference) {
    return `${reference.depotId}_${reference.manifestId}.manifest`;
}

module.exports = { extractManifestReferences, manifestFileName, referenceKey };
