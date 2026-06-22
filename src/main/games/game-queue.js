function createGameQueue() {
    const items = [];
    let locked = false;

    function list() {
        return items.map(item => ({ ...item }));
    }

    function add(item) {
        if (locked) return { success: false, code: 'queue_locked' };
        if (items.some(existing => existing.appId === item.appId)) {
            return { success: false, code: 'duplicate' };
        }
        items.push({
            appId: item.appId,
            name: item.name,
            coverUrl: item.coverUrl || null,
            autoUpdate: item.autoUpdate !== false
        });
        return { success: true, item: { ...item } };
    }

    function remove(appId, internal = false) {
        if (locked && !internal) return { success: false, code: 'queue_locked' };
        const index = items.findIndex(item => item.appId === appId);
        if (index === -1) return { success: false, code: 'not_found' };
        const [item] = items.splice(index, 1);
        return { success: true, item: { ...item } };
    }

    function clear() {
        if (locked) return { success: false, code: 'queue_locked' };
        items.length = 0;
        return { success: true };
    }

    return {
        add,
        clear,
        has: appId => items.some(item => item.appId === appId),
        isLocked: () => locked,
        list,
        remove,
        setLocked: value => { locked = Boolean(value); }
    };
}

module.exports = { createGameQueue };
