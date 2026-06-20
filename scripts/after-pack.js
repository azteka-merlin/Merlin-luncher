const path = require('path');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

module.exports = async function applyElectronFuses(context) {
    const executable = path.join(
        context.appOutDir,
        `${context.packager.appInfo.productFilename}.exe`
    );

    await flipFuses(executable, {
        version: FuseVersion.V1,
        [FuseV1Options.RunAsNode]: false,
        [FuseV1Options.EnableCookieEncryption]: true,
        [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
        [FuseV1Options.EnableNodeCliInspectArguments]: false,
        // Electron 33 only wires embedded ASAR integrity metadata on macOS.
        // Windows integrity is covered by dist/integrity.json instead.
        [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
        [FuseV1Options.OnlyLoadAppFromAsar]: true,
        [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
        // Required for BrowserWindow.loadFile() to resolve files inside app.asar.
        [FuseV1Options.GrantFileProtocolExtraPrivileges]: true
    });
};
