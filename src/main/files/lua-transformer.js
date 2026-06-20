function transformLuaContent(source) {
    let commentedLines = 0;
    const content = source.replace(/(^|\r?\n)([^\r\n]*)/g, (match, separator, line) => {
        const bom = line.startsWith('\uFEFF') ? '\uFEFF' : '';
        const lineWithoutBom = bom ? line.slice(1) : line;
        const indentation = lineWithoutBom.match(/^[ \t]*/)[0];
        const code = lineWithoutBom.slice(indentation.length);

        if (code.startsWith('--') || !/\bsetmanifestid[ \t]*\(/i.test(code)) {
            return match;
        }

        commentedLines++;
        return `${separator}${bom}${indentation}--${code}`;
    });
    return { content, commentedLines };
}

function installLuaFile(fs, sourcePath, destinationPath) {
    const source = fs.readFileSync(sourcePath, 'utf8');
    const result = transformLuaContent(source);
    fs.writeFileSync(destinationPath, result.content, 'utf8');
    return result.commentedLines;
}

module.exports = { installLuaFile, transformLuaContent };
