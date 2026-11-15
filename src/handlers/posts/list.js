const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ok } = require('../../lib/response');
const { wrap } = require('../../lib/http');
const { parseLimit } = require('../../lib/validate');
const { encodeCursor, decodeCursor } = require('../../lib/pagination');
const { db, TABLE } = require('../../lib/db');
const { toSummary } = require('../../lib/posts');

// GET /posts (public) : articles publiés, du plus récent au plus ancien
// Filtres optionnels 
exports.handler = wrap(async (event) => {
    const qs = event.queryStringParameters || {};
    const names = {};
    const values = {};
    const filters = [];
    let params;

    if (qs.author) {
        params = { IndexName: 'GSI1', KeyConditionExpression: 'GSI1PK = :pk' };
        values[':pk'] = `AUTHOR#${qs.author}`;
        filters.push('#status = :published');
        names['#status'] = 'status';
        values[':published'] = 'published';
    } else {
        params = { IndexName: 'GSI2', KeyConditionExpression: 'GSI2PK = :pk' };
        values[':pk'] = 'STATUS#published';
    }

    if (qs.tag) {
        filters.push('contains(tags, :tag)');
        values[':tag'] = qs.tag.trim().toLowerCase();
    }

    const res = await db.send(
        new QueryCommand({
            TableName: TABLE,
            ...params,
            ...(filters.length && { FilterExpression: filters.join(' AND ') }),
            ...(Object.keys(names).length && { ExpressionAttributeNames: names }),
            ExpressionAttributeValues: values,
            ScanIndexForward: false,
            Limit: parseLimit(event),
            ExclusiveStartKey: decodeCursor(qs.nextToken),
        })
    );

    return ok({
        items: (res.Items || []).map(toSummary),
        nextToken: encodeCursor(res.LastEvaluatedKey),
    });
});