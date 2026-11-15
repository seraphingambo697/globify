// Modèle "Article" : clés DynamoDB, validation, droits
const { GetCommand } = require('@aws-sdk/lib-dynamodb');
const { db, TABLE } = require('./db');
const { ROLES, hasRole } = require('./auth');
const { fail } = require('./http');
const { checkString } = require('./validate');

const STATUSES = ['draft', 'published'];

const postKey = (id) => ({ PK: `POST#${id}`, SK: 'META' });

const slugify = (text) =>
    text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);

const makeExcerpt = (content) => content.replace(/\s+/g, ' ').trim().slice(0, 200);

const isMediaKey = (k) => typeof k === 'string' && k.startsWith('uploads/') && !k.includes('..');

// Valide UNIQUEMENT les champs présents
const cleanPostInput = (body) => {
    const out = {};
    if (body.title !== undefined) out.title = checkString(body.title, 200, 'title');
    if (body.content !== undefined) out.content = checkString(body.content, 100000, 'content');
    if (body.excerpt !== undefined) out.excerpt = checkString(body.excerpt, 300, 'excerpt');

    if (body.tags !== undefined) {
        if (!Array.isArray(body.tags)) throw fail.badRequest('tags doit être un tableau');
        out.tags = [...new Set(body.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 10);
    }

    if (body.coverImage !== undefined) {
        if (body.coverImage !== null && !isMediaKey(body.coverImage)) {
            throw fail.badRequest('coverImage doit être une clé renvoyée par /media/upload-url');
        }
        out.coverImage = body.coverImage;
    }

    if (body.media !== undefined) {
        if (!Array.isArray(body.media) || body.media.length > 20 || !body.media.every(isMediaKey)) {
            throw fail.badRequest('media doit être un tableau (20 max) de clés renvoyées par /media/upload-url');
        }
        out.media = body.media;
    }

    if (body.status !== undefined) {
        if (!STATUSES.includes(body.status)) throw fail.badRequest(`status doit valoir : ${STATUSES.join(', ')}`);
        out.status = body.status;
    }

    if (out.title === '') throw fail.badRequest('title ne peut pas être vide');
    if (out.content === '') throw fail.badRequest('content ne peut pas être vide');
    return out;
};

// Construit l'élément DynamoDB complet (clés + index) à partir d'un article
const buildPostItem = (post) => ({
    ...post,
    ...postKey(post.id),
    type: 'POST',
    GSI1PK: `AUTHOR#${post.authorId}`,
    GSI1SK: post.createdAt,
    GSI2PK: `STATUS#${post.status}`,
    GSI2SK: post.status === 'published' ? post.publishedAt : post.updatedAt,
    searchText: [post.title, post.excerpt, ...(post.tags || [])].join(' ').toLowerCase(),
});

// Retire les champs techniques avant de renvoyer au client
// eslint-disable-next-line no-unused-vars
const toPublic = ({ PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, searchText, type, ...rest }) => rest;

// Version allégée pour les listes (sans le contenu complet)
const toSummary = (item) => {
    // eslint-disable-next-line no-unused-vars
    const { content, ...rest } = toPublic(item);
    return rest;
};

const getPost = async (id) => {
    const res = await db.send(new GetCommand({ TableName: TABLE, Key: postKey(id) }));
    return res.Item;
};

const isStaff = (user) => hasRole(user, ROLES.ADMIN, ROLES.EDITOR);

const canEdit = (user, post) => isStaff(user) || (post.authorId === user.id && post.status === 'draft');

module.exports = {
    STATUSES,
    postKey,
    slugify,
    makeExcerpt,
    cleanPostInput,
    buildPostItem,
    toPublic,
    toSummary,
    getPost,
    isStaff,
    canEdit,
};