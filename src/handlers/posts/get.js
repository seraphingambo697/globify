const { ok } = require('../../lib/response');
const { wrap, fail } = require('../../lib/http');
const { getPost, toPublic } = require('../../lib/posts');

// GET /posts/{id} (public) : un article publié
exports.handler = wrap(async (event) => {
    const item = await getPost(event.pathParameters.id);

    if (!item || item.status !== 'published') throw fail.notFound('Article introuvable');

    return ok(toPublic(item));
});