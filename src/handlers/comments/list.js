const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ok } = require('../../lib/response');
const { wrap } = require('../../lib/http');
const { parseLimit } = require('../../lib/validate');
const { encodeCursor, decodeCursor } = require('../../lib/pagination');
const { db, TABLE } = require('../../lib/db');
const { toPublicComment } = require('../../lib/comments');

// GET /posts/{id}/comments : commentaires approuvés, du plus ancien au plus récent
exports.handler = wrap(async (event) => {
    const qs = event.queryStringParameters || {};

    const res = await db.send(
        new QueryCommand({
            TableName: TABLE,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
            FilterExpression: '#status = :approved',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
                ':pk': `POST#${event.pathParameters.id}`,
                ':prefix': 'COMMENT#',
                ':approved': 'approved',
            },
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