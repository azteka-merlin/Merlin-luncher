const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JavaScriptObfuscator = require('javascript-obfuscator');

const rootDir = __dirname;
const nativeProjectDir = path.join(rootDir, 'OpenSteamTool');
const nativeBuildDir = path.join(nativeProjectDir, 'build');
const nativeReleaseDir = path.join(nativeBuildDir, 'Release');
const nativeSourceDir = nativeProjectDir;
const appDllDir = path.join(rootDir, 'assets', 'dlls');
const distDir = path.join(rootDir, 'dist');
const requiredDlls = ['OpenSteamTool.dll', 'dwmapi.dll', 'xinput1_4.dll'];
const helperDll = 'merlin-helper.dll';

const obfuscationOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.35,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.12,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    rotateStringArray: true,
    selfDefending: true,
    splitStrings: true,
    splitStringsChunkLength: 8,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.8,
    transformObjectKeys: true
};

function obfuscateMainForPackaging() {
    const mainFiles = [path.join(rootDir, 'main.js')];
    const srcMainDir = path.join(rootDir, 'src', 'main');

    function collectJavaScriptFiles(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                collectJavaScriptFiles(entryPath);
            } else if (entry.isFile() && entry.name.endsWith('.js')) {
                mainFiles.push(entryPath);
            }
        }
    }

    collectJavaScriptFiles(srcMainDir);
    const originals = new Map();

    function restore() {
        for (const [filePath, source] of originals) {
            fs.writeFileSync(filePath, source);
        }
    }

    try {
        for (const filePath of mainFiles) {
            const source = fs.readFileSync(filePath, 'utf8');
            originals.set(filePath, source);
            const obfuscated = JavaScriptObfuscator
                .obfuscate(source, obfuscationOptions)
                .getObfuscatedCode();
            fs.writeFileSync(filePath, obfuscated);
        }
    } catch (error) {
        restore();
        throw error;
    }

    return restore;
}

function sha256(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function writeIntegrityManifest() {
    const files = [
        ...fs.readdirSync(distDir)
            .filter(file => file.toLowerCase().endsWith('.exe'))
            .map(file => path.join(distDir, file)),
        ...requiredDlls.map(dll => path.join(appDllDir, dll))
    ].filter(fs.existsSync);

    const manifest = {
        generatedAt: new Date().toISOString(),
        algorithm: 'SHA-256',
        files: files.map(file => ({
            path: path.relative(rootDir, file).replace(/\\/g, '/'),
            size: fs.statSync(file).size,
            sha256: sha256(file)
        }))
    };

    fs.writeFileSync(
        path.join(distDir, 'integrity.json'),
        JSON.stringify(manifest, null, 2)
    );
}

function cleanBuildDirectory(buildDir) {
    try {
        fs.rmSync(buildDir, {
            recursive: true,
            force: true,
            maxRetries: 20,
            retryDelay: 500
        });
        return;
    } catch (error) {
        if (!['EBUSY', 'EPERM'].includes(error.code) || !fs.existsSync(buildDir)) {
            throw error;
        }

        console.warn(`Build directory is locked; cleaning its contents instead: ${buildDir}`);
        for (const entry of fs.readdirSync(buildDir)) {
            fs.rmSync(path.join(buildDir, entry), {
                recursive: true,
                force: true,
                maxRetries: 20,
                retryDelay: 500
            });
        }
    }
}

// Prevent MSBuild worker processes from surviving a completed build and
// briefly locking files when the next clean build removes OpenSteamTool/build.
process.env.MSBUILDDISABLENODEREUSE = '1';

if (!fs.existsSync(path.join(nativeProjectDir, 'CMakeLists.txt'))) {
    throw new Error(
        `OpenSteamTool source tree not found: ${nativeProjectDir}`
    );
}

const hasNinja = (() => {
    try {
        execSync('where ninja', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
})();
const generator = hasNinja ? 'Ninja Multi-Config' : 'Visual Studio 17 2022';

console.log(`Building OpenSteamTool DLLs from ${nativeProjectDir} (Release)...`);
cleanBuildDirectory(nativeBuildDir);
const configureArgs = ['-S', nativeSourceDir, '-B', nativeBuildDir, '-G', generator];
if (!hasNinja) {
    configureArgs.push('-A', 'x64');
}
execFileSync('cmake', configureArgs, {
    cwd: nativeProjectDir,
    stdio: 'inherit',
    env: { ...process.env }
});
execFileSync('cmake', ['--build', nativeBuildDir, '--config', 'Release'], {
    cwd: nativeProjectDir,
    stdio: 'inherit',
    env: { ...process.env }
});

for (const dll of requiredDlls) {
    const output = path.join(nativeReleaseDir, dll);
    if (!fs.existsSync(output)) {
        throw new Error(`OpenSteamTool did not produce ${output}`);
    }
}

fs.mkdirSync(appDllDir, { recursive: true });
for (const dll of requiredDlls) {
    fs.copyFileSync(
        path.join(nativeReleaseDir, dll),
        path.join(appDllDir, dll)
    );
}
console.log(`OpenSteamTool DLLs copied to ${appDllDir}`);

const helperOutput = path.join(nativeReleaseDir, helperDll);
if (fs.existsSync(helperOutput)) {
    fs.copyFileSync(helperOutput, path.join(appDllDir, helperDll));
    console.log(`Merlin helper DLL copied to ${appDllDir}`);
}

const dllsOnly = process.argv.includes('--opensteamtool-only') || process.argv.includes('--lumacore-only');

if (dllsOnly) {
    console.log('OpenSteamTool Release DLLs are ready.');
} else {
    console.log('Cleaning previous Electron build artifacts...');
    cleanBuildDirectory(distDir);
    const restoreMain = obfuscateMainForPackaging();
    console.log('Building obfuscated Electron package...');
    try {
        execSync('electron-builder --publish never', { cwd: rootDir, stdio: 'inherit' });
    } finally {
        restoreMain();
    }
    writeIntegrityManifest();
    console.log('Obfuscated package and integrity manifest generated.');
}
