const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ok } = require('../../lib/response');
const { wrap, fail } = require('../../lib/http');
const { parseLimit } = require('../../lib/validate');
const { encodeCursor, decodeCursor } = require('../../lib/pagination');
const { db, TABLE } = require('../../lib/db');
const { toSummary } = require('../../lib/posts');

const MAX_PAGES = 5;

// GET /search?q=mot&tag=aws (public) : recherche dans les articles publiés
// Recherche simple par "contient" sur le titre, le résumé et les tags.
exports.handler = wrap(async (event) => {
    const qs = event.queryStringParameters || {};
    const q = (qs.q || '').trim().toLowerCase();
    const tag = (qs.tag || '').trim().toLowerCase();
    if (!q && !tag) throw fail.badRequest('Paramètre q ou tag requis');
    if (q && q.length < 2) throw fail.badRequest('q : 2 caractères minimum');

    const limit = parseLimit(event, 10, 50);
    const filters = [];
    const values = { ':pk': 'STATUS#published' };
    if (q) {
        filters.push('contains(searchText, :q)');
        values[':q'] = q;
    }
    if (tag) {
        filters.push('contains(tags, :tag)');
        values[':tag'] = tag;
    }

    const results = [];
    let lastKey = decodeCursor(qs.nextToken);
    let pages = 0;
    do {
        const res = await db.send(
            new QueryCommand({
                TableName: TABLE,
                IndexName: 'GSI2',
                KeyConditionExpression: 'GSI2PK = :pk',
                FilterExpression: filters.join(' AND '),
                ExpressionAttributeValues: values,
                ScanIndexForward: false,
                Limit: 100,
                ExclusiveStartKey: lastKey,
            })
        );
        results.push(...(res.Items || []));
        lastKey = res.LastEvaluatedKey;
        pages++;
    } while (lastKey && results.length < limit && pages < MAX_PAGES);

    if (results.length > limit) {
        const last = results[limit - 1];
        lastKey = { PK: last.PK, SK: last.SK, GSI2PK: last.GSI2PK, GSI2SK: last.GSI2SK };
    }

    return ok({
        query: q || null,
        tag: tag || null,
        items: results.slice(0, limit).map(toSummary),
        nextToken: encodeCursor(lastKey),
    });
});