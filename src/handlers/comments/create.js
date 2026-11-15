const { randomUUID } = require('node:crypto');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { created } = require('../../lib/response');
const { wrap, fail } = require('../../lib/http');
const { parseBody, requireFields, checkString } = require('../../lib/validate');
const { db, TABLE } = require('../../lib/db');
const { getPost } = require('../../lib/posts');
const { commentKey, toPublicComment } = require('../../lib/comments');

// POST /posts/{id}/comments (public)
exports.handler = wrap(async (event) => {
    const postId = event.pathParameters.id;
    const body = parseBody(event);
    requireFields(body, ['authorName', 'content']);
    const authorName = checkString(body.authorName, 50, 'authorName');
    const content = checkString(body.content, 2000, 'content');

    const post = await getPost(postId);
    if (!post || post.status !== 'published') throw fail.notFound('Article introuvable');

    const now = new Date().toISOString();
    // Identifiant triable par date 
    const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;

    const item = {
        ...commentKey(postId, id),
        type: 'COMMENT',
        id,
        postId,
        authorName,
        content,
        status: 'pending',
        createdAt: now,
        GSI2PK: 'COMMENT#pending',
        GSI2SK: now,
    };

    await db.send(new PutCommand({ TableName: TABLE, Item: item }));

    return created({ ...toPublicComment(item), message: 'Commentaire en attente de modération' });
});