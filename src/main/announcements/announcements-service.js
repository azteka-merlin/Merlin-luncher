function createAnnouncementsService({ authSession, announcementsClient }) {
    let cachedAnnouncement = null;

    async function getAccessToken() {
        if (!authSession?.getAccessToken) {
            const error = new Error('Authentication is not available');
            error.code = 'auth_required';
            throw error;
        }
        return authSession.getAccessToken();
    }

    async function withAuthRetry(callback) {
        let accessToken = await getAccessToken();
        try {
            return await callback(accessToken);
        } catch (error) {
            if (error?.response?.status !== 401) throw error;
            await authSession.handleUnauthorized();
            accessToken = await getAccessToken();
            return callback(accessToken);
        }
    }

    async function eligible() {
        try {
            const announcement = await withAuthRetry(accessToken => announcementsClient.eligible(accessToken));
            cachedAnnouncement = announcement;
            return { success: true, announcement };
        } catch (error) {
            const code = error?.code === 'missing' || error?.code === 'auth_required' || error?.response?.status === 401
                ? 'auth_required'
                : 'announcements_failed';
            return {
                success: false,
                code,
                message: error?.message || 'Could not load announcement',
                announcement: cachedAnnouncement
            };
        }
    }

    async function recordView(payload) {
        const announcementId = Number(payload?.announcementId);
        if (!Number.isInteger(announcementId) || announcementId <= 0) {
            return { success: false, code: 'invalid_announcement' };
        }

        try {
            await withAuthRetry(accessToken => announcementsClient.recordView({ announcementId, accessToken }));
            return { success: true };
        } catch (error) {
            return {
                success: false,
                code: error?.response?.status === 401 ? 'auth_required' : 'view_failed',
                message: error?.response?.data?.error || error?.message || 'Could not record view'
            };
        }
    }

    async function dismiss(payload) {
        const announcementId = Number(payload?.announcementId);
        if (!Number.isInteger(announcementId) || announcementId <= 0) {
            return { success: false, code: 'invalid_announcement' };
        }

        try {
            await withAuthRetry(accessToken => announcementsClient.dismiss({ announcementId, accessToken }));
            if (cachedAnnouncement?.id === announcementId) cachedAnnouncement = null;
            return { success: true };
        } catch (error) {
            return {
                success: false,
                code: error?.response?.status === 401 ? 'auth_required' : 'dismiss_failed',
                message: error?.response?.data?.error || error?.message || 'Could not dismiss announcement'
            };
        }
    }

    return {
        eligible,
        recordView,
        dismiss
    };
}

module.exports = { createAnnouncementsService };
