const { randomUUID } = require('node:crypto');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { created } = require('../../lib/response');
const { wrap, fail } = require('../../lib/http');
const { parseBody, requireFields } = require('../../lib/validate');
const { getUser, requireRole, ALL_ROLES } = require('../../lib/auth');
const { db, TABLE } = require('../../lib/db');
const { cleanPostInput, buildPostItem, toPublic, slugify, makeExcerpt, isStaff } = require('../../lib/posts');

// POST /posts (admin, editor, guest_author) : crée un article
exports.handler = wrap(async (event) => {
    const user = getUser(event);
    requireRole(user, ...ALL_ROLES);

    const body = parseBody(event);
    requireFields(body, ['title', 'content']);
    const input = cleanPostInput(body);

    const status = input.status || 'draft';
    if (status === 'published' && !isStaff(user)) {
        throw fail.forbidden('Seuls les éditeurs et administrateurs peuvent publier');
    }

    const now = new Date().toISOString();
    const post = {
        id: randomUUID(),
        title: input.title,
        slug: slugify(input.title),
        content: input.content,
        excerpt: input.excerpt || makeExcerpt(input.content),
        tags: input.tags || [],
        coverImage: input.coverImage || null,
        media: input.media || [],
        status,
        authorId: user.id,
        authorName: user.name,
        createdAt: now,
        updatedAt: now,
        publishedAt: status === 'published' ? now : null,
    };

    const item = buildPostItem(post);
    await db.send(
        new PutCommand({ TableName: TABLE, Item: item, ConditionExpression: 'attribute_not_exists(PK)' })
    );

    return created(toPublic(item));
});