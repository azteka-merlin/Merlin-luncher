function createGameNameResolver({ axios, timeout = 4000 }) {
    const cache = new Map();
    let requestQueue = Promise.resolve();

    function resolve(appId, fallbackName) {
        if (cache.has(appId)) return Promise.resolve(cache.get(appId));

        const task = requestQueue.then(async () => {
            if (cache.has(appId)) return cache.get(appId);

            let name = fallbackName;
            try {
                const response = await axios.get('https://store.steampowered.com/api/appdetails', {
                    params: { appids: appId, l: 'english' },
                    timeout
                });
                const details = response.data?.[appId];
                const officialName = details?.success && typeof details.data?.name === 'string'
                    ? details.data.name.trim()
                    : '';
                if (officialName) name = officialName;
            } catch (error) {
                console.warn(`Unable to resolve Steam name for ${appId}:`, error.message);
            }

            cache.set(appId, name);
            return name;
        });

        requestQueue = task.catch(() => {});
        return task;
    }

    return { resolve };
}

module.exports = { createGameNameResolver };
