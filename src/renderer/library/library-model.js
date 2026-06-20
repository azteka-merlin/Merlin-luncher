(function exposeLibraryModel(root, factory) {
    const model = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = model;
    if (root) root.libraryModel = model;
}(typeof window !== 'undefined' ? window : null, () => {
    function filterItems(items, term) {
        const normalized = String(term || '').trim().toLocaleLowerCase();
        if (!normalized) return [...items];
        return items.filter(item =>
            String(item.gameName || '').toLocaleLowerCase().includes(normalized)
            || item.appId.includes(normalized));
    }

    function paginate(items, requestedPage, pageSize) {
        const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
        const currentPage = Math.max(1, Math.min(requestedPage, totalPages));
        const start = (currentPage - 1) * pageSize;
        return {
            currentPage,
            totalPages,
            visible: items.slice(start, start + pageSize)
        };
    }

    return { filterItems, paginate };
}));
