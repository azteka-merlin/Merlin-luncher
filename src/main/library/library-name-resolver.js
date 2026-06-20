function createLibraryNameResolver({ axios, timeout = 4000, minInterval = 250 }) {
    let requestQueue = Promise.resolve();
    let lastRequestAt = 0;

    function resolve(appId) {
        const task = requestQueue.then(async () => {
            const wait = lastRequestAt + minInterval - Date.now();
            if (wait > 0) await new Promise(resolveWait => setTimeout(resolveWait, wait));
            lastRequestAt = Date.now();

            try {
                const response = await axios.get('https://store.steampowered.com/api/appdetails', {
                    params: { appids: appId, l: 'english' },
                    timeout
                });
                const details = response.data?.[appId];
                const name = details?.success && typeof details.data?.name === 'string'
                    ? details.data.name.trim()
                    : '';
                return name || null;
            } catch (error) {
                console.warn(`Unable to resolve Library name for ${appId}:`, error.message);
                return null;
            }
        });

        requestQueue = task.catch(() => null);
        return task;
    }

    return { resolve };
}

module.exports = { createLibraryNameResolver };
