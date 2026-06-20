function createMachineIdentity({ crypto, execFile, os, platform = process.platform }) {
    let cachedHwid = null;

    function queryWindowsMachineGuid() {
        return new Promise((resolve, reject) => {
            execFile(
                'reg.exe',
                ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
                { windowsHide: true },
                (error, stdout) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    const match = String(stdout).match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i);
                    if (!match) {
                        reject(new Error('Windows MachineGuid was not found'));
                        return;
                    }
                    resolve(match[1].trim());
                }
            );
        });
    }

    async function getHwid() {
        if (cachedHwid) return cachedHwid;

        const machineSource = platform === 'win32'
            ? await queryWindowsMachineGuid()
            : `${os.hostname()}|${os.homedir()}|${platform}|${os.arch()}`;

        cachedHwid = `merlin-${crypto
            .createHash('sha256')
            .update(machineSource, 'utf8')
            .digest('hex')}`;
        return cachedHwid;
    }

    return { getHwid };
}

module.exports = { createMachineIdentity };
