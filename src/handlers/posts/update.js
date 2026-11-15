const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { ok } = require('../../lib/response');
const { wrap, fail } = require('../../lib/http');
const { parseBody } = require('../../lib/validate');
const { getUser } = require('../../lib/auth');
const { db, TABLE } = require('../../lib/db');
const {
    getPost, cleanPostInput, buildPostItem, toPublic, slugify, makeExcerpt, canEdit, isStaff,
} = require('../../lib/posts');

// PUT /posts/{id} (connecté) : modifie un article 
exports.handler = wrap(async (event) => {
    const user = getUser(event);
    const existing = await getPost(event.pathParameters.id);
    if (!existing) throw fail.notFound('Article introuvable');
    if (!canEdit(user, existing)) {
        throw fail.forbidden('Vous ne pouvez modifier que vos propres brouillons');
    }

    const input = cleanPostInput(parseBody(event));
    if (Object.keys(input).length === 0) throw fail.badRequest('Aucun champ à modifier');

    if (input.status && input.status !== existing.status && !isStaff(user)) {
        throw fail.forbidden('Seuls les éditeurs et administrateurs peuvent changer le statut');
    }

    const now = new Date().toISOString();
    const updated = { ...toPublic(existing), ...input, updatedAt: now };
    if (input.title) updated.slug = slugify(input.title);
    if (input.content && !input.excerpt) updated.excerpt = makeExcerpt(input.content);
    if (updated.status === 'published' && !existing.publishedAt) updated.publishedAt = now;

    const item = buildPostItem(updated);

    await db.send(
        new PutCommand({
            TableName: TABLE,
            Item: item,
            ConditionExpression: 'updatedAt = :previous',
            ExpressionAttributeValues: { ':previous': existing.updatedAt },
        })
    );

    return ok(toPublic(item));
});