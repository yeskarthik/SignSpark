const { TableClient } = require('@azure/data-tables');

const TABLE_NAME = process.env.PROFILE_TABLE_NAME || 'SignSparkProfiles';
const PARTITION_KEY = 'learner';
const PROFILE_NAMES = new Set(['Kar', 'Shy', 'Lav', 'Swa', 'Rah']);
const MAX_WRITE_ATTEMPTS = 4;

let tableClient = null;
let tableReady = null;

module.exports = async function profileProgress(context, req) {
    const profile = req.params.profile;
    if (!PROFILE_NAMES.has(profile)) {
        context.res = jsonResponse(404, { error: 'Profile not found.' });
        return;
    }

    try {
        const client = await getTableClient();
        if (req.method === 'GET') {
            const { state } = await loadState(client, profile);
            context.res = jsonResponse(200, state);
            return;
        }

        const result = req.body;
        if (!isValidResult(result)) {
            context.res = jsonResponse(400, {
                error: 'A result requires a valid slug and boolean correct value.'
            });
            return;
        }

        const state = await recordResult(client, profile, result.slug, result.correct);
        context.res = jsonResponse(200, state);
    } catch (error) {
        context.log.error('Profile storage request failed.', error);
        context.res = jsonResponse(500, { error: 'Profile progress could not be saved.' });
    }
};

async function getTableClient() {
    if (!tableClient) {
        const connectionString = process.env.PROFILE_STORAGE_CONNECTION_STRING;
        if (!connectionString) {
            throw new Error('PROFILE_STORAGE_CONNECTION_STRING is not configured.');
        }
        tableClient = TableClient.fromConnectionString(connectionString, TABLE_NAME);
        tableReady = tableClient.createTable().catch(error => {
            if (error.statusCode !== 409) throw error;
        });
    }

    await tableReady;
    return tableClient;
}

async function recordResult(client, profile, slug, correct) {
    let concurrencyError = null;

    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
        const current = await loadState(client, profile);
        const state = current.state;
        const card = state.cardStats[slug] || { seen: 0, correct: 0, incorrect: 0 };

        card.seen++;
        state.stats.studied++;
        if (correct) {
            card.correct++;
            state.stats.correct++;
            state.stats.streak++;
            state.stats.bestStreak = Math.max(
                state.stats.bestStreak,
                state.stats.streak
            );
            state.pendingRetries = state.pendingRetries.filter(item => item !== slug);
        } else {
            card.incorrect++;
            state.stats.incorrect++;
            state.stats.streak = 0;
            if (!state.pendingRetries.includes(slug)) {
                state.pendingRetries.push(slug);
            }
        }
        state.cardStats[slug] = card;

        try {
            await saveState(client, profile, state, current.etag);
            return state;
        } catch (error) {
            if (![409, 412].includes(error.statusCode)) throw error;
            concurrencyError = error;
        }
    }

    throw concurrencyError || new Error('Profile progress update did not complete.');
}

async function loadState(client, profile) {
    try {
        const entity = await client.getEntity(PARTITION_KEY, profile);
        return {
            state: {
                stats: JSON.parse(entity.statsJson),
                cardStats: JSON.parse(entity.cardStatsJson),
                pendingRetries: JSON.parse(entity.pendingRetriesJson)
            },
            etag: entity.etag
        };
    } catch (error) {
        if (error.statusCode === 404) {
            return { state: createState(), etag: null };
        }
        throw error;
    }
}

async function saveState(client, profile, state, etag) {
    const entity = {
        partitionKey: PARTITION_KEY,
        rowKey: profile,
        statsJson: JSON.stringify(state.stats),
        cardStatsJson: JSON.stringify(state.cardStats),
        pendingRetriesJson: JSON.stringify(state.pendingRetries),
        updatedAt: new Date().toISOString()
    };

    if (etag) {
        await client.updateEntity(entity, 'Replace', { etag });
    } else {
        await client.createEntity(entity);
    }
}

function createState() {
    return {
        stats: {
            studied: 0,
            correct: 0,
            incorrect: 0,
            streak: 0,
            bestStreak: 0
        },
        cardStats: {},
        pendingRetries: []
    };
}

function isValidResult(result) {
    return result &&
        typeof result.correct === 'boolean' &&
        typeof result.slug === 'string' &&
        result.slug.length <= 100 &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug);
}

function jsonResponse(status, body) {
    return {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
        },
        body
    };
}
