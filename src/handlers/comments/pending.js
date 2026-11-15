const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ok } = require('../../lib/response');
const { wrap } = require('../../lib/http');
const { parseLimit } = require('../../lib/validate');
const { encodeCursor, decodeCursor } = require('../../lib/pagination');
const { getUser, requireRole, ROLES } = require('../../lib/auth');
const { db, TABLE } = require('../../lib/db');
const { toPublicComment } = require('../../lib/comments');

// GET /comments/pending (admin, editor)
exports.handler = wrap(async (event) => {
    requireRole(getUser(event), ROLES.ADMIN, ROLES.EDITOR);
    const qs = event.queryStringParameters || {};

    const res = await db.send(
        new QueryCommand({
            TableName: TABLE,
            IndexName: 'GSI2',
            KeyConditionExpression: 'GSI2PK = :pk',
            ExpressionAttributeValues: { ':pk': 'COMMENT#pending' },
            ScanIndexForward: true,
            Limit: parseLimit(event, 20, 100),
            ExclusiveStartKey: decodeCursor(qs.nextToken),
        })
    );

    return ok({
        items: (res.Items || []).map(toPublicComment),
        nextToken: encodeCursor(res.LastEvaluatedKey),
    });
});