function createConfigStore({ fs, path, getFilePath, defaults }) {
    let config = { ...defaults };

    function load() {
        try {
            const configFile = getFilePath();
            if (fs.existsSync(configFile)) {
                const savedConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                config = { ...defaults, ...savedConfig };
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
        return config;
    }

    function save() {
        try {
            const configFile = getFilePath();
            fs.mkdirSync(path.dirname(configFile), { recursive: true });
            fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('Error saving config:', error);
        }
    }

    function get() {
        return config;
    }

    function update(values) {
        config = { ...config, ...values };
        save();
        return config;
    }

    return { get, load, save, update };
}

module.exports = { createConfigStore };
