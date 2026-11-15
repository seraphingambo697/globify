const { QueryCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { noContent } = require('../../lib/response');
const { wrap, fail } = require('../../lib/http');
const { getUser, hasRole, ROLES } = require('../../lib/auth');
const { db, TABLE } = require('../../lib/db');
const { getPost } = require('../../lib/posts');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Supprime par lots de 25 (limite DynamoDB)
const batchDelete = async (keys) => {
    let pending = { [TABLE]: keys.map((Key) => ({ DeleteRequest: { Key } })) };
    for (let attempt = 0; attempt < 5 && pending && Object.keys(pending).length; attempt++) {
        if (attempt > 0) await sleep(100 * 2 ** attempt);
        const res = await db.send(new BatchWriteCommand({ RequestItems: pending }));
        pending = res.UnprocessedItems;
    }
};

// DELETE /posts/{id} : admin/editor, ou l'auteur pour ses brouillons
exports.handler = wrap(async (event) => {
    const user = getUser(event);
    const id = event.pathParameters.id;

    const existing = await getPost(id);
    if (!existing) throw fail.notFound('Article introuvable');

    const allowed =
        hasRole(user, ROLES.ADMIN, ROLES.EDITOR) ||
        (existing.authorId === user.id && existing.status === 'draft');
    if (!allowed) throw fail.forbidden('Vous ne pouvez supprimer que vos propres brouillons');

    const keys = [];
    let lastKey;
    do {
        const res = await db.send(
            new QueryCommand({
                TableName: TABLE,
                KeyConditionExpression: 'PK = :pk',
                ExpressionAttributeValues: { ':pk': `POST#${id}` },
                ProjectionExpression: 'PK, SK',
                ExclusiveStartKey: lastKey,
            })
        );
        keys.push(...res.Items);
        lastKey = res.LastEvaluatedKey;
    } while (lastKey);

    for (let i = 0; i < keys.length; i += 25) {
        await batchDelete(keys.slice(i, i + 25));
    }

    return noContent();
});