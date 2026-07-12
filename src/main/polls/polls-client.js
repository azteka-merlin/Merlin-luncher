const DEFAULT_POLLS_URL = 'https://api-merlin.com/api/polls/active';

function normalizeOption(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const id = Number(entry.id);
    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    if (!Number.isInteger(id) || id <= 0 || !label) return null;

    return {
        id,
        label,
        gameAppId: typeof entry.gameAppId === 'string' ? entry.gameAppId.trim() || null : null,
        votes: Math.max(0, Math.trunc(Number(entry.votes) || 0)),
        percent: Math.max(0, Math.min(100, Math.trunc(Number(entry.percent) || 0))),
        selected: entry.selected === true
    };
}

function normalizeContributionOption(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const id = entry.id === null ? null : Number(entry.id);
    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    if (id !== null && (!Number.isInteger(id) || id <= 0)) return null;
    if (!label) return null;

    return {
        id,
        label,
        minAmount: entry.minAmount === null || entry.minAmount === undefined ? null : Math.max(0, Math.trunc(Number(entry.minAmount) || 0)),
        maxAmount: entry.maxAmount === null || entry.maxAmount === undefined ? null : Math.max(0, Math.trunc(Number(entry.maxAmount) || 0)),
        votes: Math.max(0, Math.trunc(Number(entry.votes) || 0)),
        percent: Math.max(0, Math.min(100, Math.trunc(Number(entry.percent) || 0))),
        selected: entry.selected === true,
        skipped: entry.skipped === true
    };
}

function normalizePoll(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const id = Number(entry.id);
    const question = typeof entry.question === 'string' ? entry.question.trim() : '';
    const type = entry.type === 'game_request' ? 'game_request' : 'basic';
    const options = Array.isArray(entry.options) ? entry.options.map(normalizeOption).filter(Boolean) : [];
    if (!Number.isInteger(id) || id <= 0 || !question || options.length < 2) return null;

    const contributionResultsByOptionId = {};
    const rawContributionResults = entry.contributionResultsByOptionId && typeof entry.contributionResultsByOptionId === 'object'
        ? entry.contributionResultsByOptionId
        : {};
    for (const [optionId, results] of Object.entries(rawContributionResults)) {
        contributionResultsByOptionId[optionId] = Array.isArray(results)
            ? results.map(normalizeContributionOption).filter(Boolean)
            : [];
    }

    const viewer = entry.viewer && typeof entry.viewer === 'object'
        ? {
            voted: entry.viewer.voted === true,
            optionId: entry.viewer.optionId ? Number(entry.viewer.optionId) : null,
            contributionOptionId: entry.viewer.contributionOptionId ? Number(entry.viewer.contributionOptionId) : null,
            contributionSkipped: entry.viewer.contributionSkipped === true,
            votedAt: typeof entry.viewer.votedAt === 'string' ? entry.viewer.votedAt : null
        }
        : { voted: false, optionId: null, contributionOptionId: null, contributionSkipped: false, votedAt: null };

    return {
        id,
        type,
        question,
        status: entry.status === 'open' ? 'open' : String(entry.status || 'draft'),
        currencyCode: typeof entry.currencyCode === 'string' ? entry.currencyCode.trim().toUpperCase() || 'BRL' : 'BRL',
        totalVotes: Math.max(0, Math.trunc(Number(entry.totalVotes) || 0)),
        options,
        contributionOptions: Array.isArray(entry.contributionOptions)
            ? entry.contributionOptions.map(normalizeContributionOption).filter(Boolean)
            : [],
        contributionResultsByOptionId,
        viewer
    };
}

function createPollsClient({
    axios,
    activeUrl = DEFAULT_POLLS_URL,
    voteUrl = DEFAULT_POLLS_URL.replace(/\/active$/, ''),
    timeout = 12000
}) {
    async function requestActive(accessToken) {
        const response = await axios.get(activeUrl, {
            timeout,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json'
            }
        });

        if (!response.data || !Array.isArray(response.data.polls)) {
            throw new Error('Invalid polls payload');
        }

        return response.data.polls.map(normalizePoll).filter(Boolean);
    }

    async function vote({ pollId, optionId, contributionOptionId, contributionSkipped, accessToken }) {
        const response = await axios.post(
            `${voteUrl}/${encodeURIComponent(String(pollId))}/vote`,
            {
                ...(optionId ? { optionId } : {}),
                ...(contributionOptionId ? { contributionOptionId } : {}),
                ...(contributionSkipped === true ? { contributionSkipped: true } : {})
            },
            {
                timeout,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        );

        return normalizePoll(response.data?.poll);
    }

    return {
        requestActive,
        vote
    };
}

module.exports = {
    DEFAULT_POLLS_URL,
    createPollsClient
};
