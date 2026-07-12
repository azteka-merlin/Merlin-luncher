function createPollsService({ authSession, pollsClient }) {
    let cachedPolls = [];

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

    async function active() {
        try {
            const polls = await withAuthRetry(accessToken => pollsClient.requestActive(accessToken));
            cachedPolls = polls;
            return { success: true, polls };
        } catch (error) {
            const code = error?.code === 'missing' || error?.code === 'auth_required' || error?.response?.status === 401
                ? 'auth_required'
                : 'polls_failed';
            return {
                success: false,
                code,
                message: error?.message || 'Could not load polls',
                polls: cachedPolls
            };
        }
    }

    async function vote(payload) {
        const pollId = Number(payload?.pollId);
        const optionId = payload?.optionId ? Number(payload.optionId) : null;
        const contributionOptionId = payload?.contributionOptionId ? Number(payload.contributionOptionId) : null;
        const contributionSkipped = payload?.contributionSkipped === true;

        if (!Number.isInteger(pollId) || pollId <= 0) {
            return { success: false, code: 'invalid_poll' };
        }

        try {
            const poll = await withAuthRetry(accessToken => pollsClient.vote({
                pollId,
                optionId,
                contributionOptionId,
                contributionSkipped,
                accessToken
            }));

            if (!poll) {
                return { success: false, code: 'polls_failed' };
            }

            cachedPolls = cachedPolls.map(entry => entry.id === poll.id ? poll : entry);
            if (!cachedPolls.some(entry => entry.id === poll.id)) cachedPolls.unshift(poll);
            return { success: true, poll };
        } catch (error) {
            const code = error?.response?.status === 409
                ? 'already_voted'
                : error?.response?.status === 401
                    ? 'auth_required'
                    : 'vote_failed';
            return {
                success: false,
                code,
                message: error?.response?.data?.error || error?.message || 'Could not vote'
            };
        }
    }

    return {
        active,
        vote
    };
}

module.exports = { createPollsService };
