const { randomUUID } = require('crypto');
const { TableClient } = require('@azure/data-tables');

const TABLE_NAME = process.env.VIDEO_REPORT_TABLE_NAME || 'SignSparkVideoReports';
const PROFILE_NAMES = new Set(['Kar', 'Shy', 'Lav', 'Swa', 'Rah', 'Guest']);
const PURPOSES = new Set(['learning', 'quiz']);
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

let tableClient = null;
let tableReady = null;

module.exports = async function videoReports(context, req) {
    if (!isValidReport(req.body)) {
        context.res = jsonResponse(400, { error: 'Invalid video report.' });
        return;
    }

    try {
        const client = await getTableClient();
        const report = req.body;
        const reportId = randomUUID();
        await client.createEntity({
            partitionKey: report.videoId,
            rowKey: reportId,
            slug: report.slug,
            word: report.word,
            purpose: report.purpose,
            profile: report.profile,
            pageUrl: report.pageUrl,
            userAgent: String(req.headers?.['user-agent'] || '').slice(0, 512),
            reportedAt: new Date().toISOString(),
            status: 'new'
        });

        context.res = jsonResponse(201, { reportId });
    } catch (error) {
        context.log.error('Video report storage failed.', error);
        context.res = jsonResponse(500, { error: 'Video report could not be saved.' });
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

function isValidReport(report) {
    if (!report || typeof report !== 'object') return false;
    if (!SLUG_PATTERN.test(report.slug || '') || report.slug.length > 100) return false;
    if (typeof report.word !== 'string' || report.word.length < 1 || report.word.length > 100) {
        return false;
    }
    if (!YOUTUBE_ID_PATTERN.test(report.videoId || '')) return false;
    if (!PURPOSES.has(report.purpose)) return false;
    if (!PROFILE_NAMES.has(report.profile)) return false;

    try {
        const pageUrl = new URL(report.pageUrl);
        return ['http:', 'https:'].includes(pageUrl.protocol) && report.pageUrl.length <= 500;
    } catch {
        return false;
    }
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
