const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { ok } = require('../../lib/response');
const { wrap, fail } = require('../../lib/http');
const { parseBody, requireFields } = require('../../lib/validate');
const { getUser, requireRole, ROLES } = require('../../lib/auth');
const { db, TABLE } = require('../../lib/db');
const { commentKey, toPublicComment } = require('../../lib/comments');

// PATCH /posts/{id}/comments/{commentId} (admin, editor) 
exports.handler = wrap(async (event) => {
    const user = getUser(event);
    requireRole(user, ROLES.ADMIN, ROLES.EDITOR);

    const { id: postId, commentId } = event.pathParameters;
    const body = parseBody(event);
    requireFields(body, ['status']);
    if (!['approved', 'rejected'].includes(body.status)) {
        throw fail.badRequest('status doit valoir : approved, rejected');
    }

    try {
        const res = await db.send(
            new UpdateCommand({
                TableName: TABLE,
                Key: commentKey(postId, commentId),
                UpdateExpression: 'SET #status = :status, GSI2PK = :gsi, moderatedBy = :by, moderatedAt = :at',
                ConditionExpression: 'attribute_exists(PK)',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: {
                    ':status': body.status,
                    ':gsi': `COMMENT#${body.status}`,
                    ':by': user.id,
                    ':at': new Date().toISOString(),
                },
                ReturnValues: 'ALL_NEW',
            })
        );
        return ok(toPublicComment(res.Attributes));
    } catch (err) {
        if (err.name === 'ConditionalCheckFailedException') throw fail.notFound('Commentaire introuvable');
        throw err;
    }
});