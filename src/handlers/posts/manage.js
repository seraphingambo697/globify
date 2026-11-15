const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ok } = require('../../lib/response');
const { wrap, fail } = require('../../lib/http');
const { parseLimit } = require('../../lib/validate');
const { encodeCursor, decodeCursor } = require('../../lib/pagination');
const { getUser, requireRole, ALL_ROLES } = require('../../lib/auth');
const { db, TABLE } = require('../../lib/db');
const { STATUSES, toPublic, isStaff } = require('../../lib/posts');

// GET /manage/posts : espace de gestion, brouillons inclus
// - guest_author : ses propres articles
exports.handler = wrap(async (event) => {
    const user = getUser(event);
    requireRole(user, ...ALL_ROLES);

    const qs = event.queryStringParameters || {};
    if (qs.status && !STATUSES.includes(qs.status)) {
        throw fail.badRequest(`status doit valoir : ${STATUSES.join(', ')}`);
    }

    let params;
    if (!isStaff(user) || qs.mine === 'true') {
        params = {
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ExpressionAttributeValues: { ':pk': `AUTHOR#${user.id}` },
        };
        if (qs.status) {
            params.FilterExpression = '#status = :status';
            params.ExpressionAttributeNames = { '#status': 'status' };
            params.ExpressionAttributeValues[':status'] = qs.status;
        }
    } else {
        params = {
            IndexName: 'GSI2',
            KeyConditionExpression: 'GSI2PK = :pk',
            ExpressionAttributeValues: { ':pk': `STATUS#${qs.status || 'draft'}` },
        };
    }

    const res = await db.send(
        new QueryCommand({
            TableName: TABLE,
            ...params,
            ScanIndexForward: false,
            Limit: parseLimit(event, 20, 50),
            ExclusiveStartKey: decodeCursor(qs.nextToken),
        })
    );

    return ok({
        items: (res.Items || []).map(toPublic),
        nextToken: encodeCursor(res.LastEvaluatedKey),
    });
});