const { randomUUID } = require('node:crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { ok } = require('../../lib/response');
const { wrap, fail } = require('../../lib/http');
const { parseBody, requireFields } = require('../../lib/validate');
const { getUser, requireRole, ALL_ROLES } = require('../../lib/auth');

// WHEN_REQUIRED : évite que le SDK ajoute une somme de contrôle qui ferait échouer l'envoi
const s3 = new S3Client({ requestChecksumCalculation: 'WHEN_REQUIRED' });

const ALLOWED_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
};
const EXPIRES_IN = 300; // 5 minutes

// POST /media/upload-url (connecté) 
exports.handler = wrap(async (event) => {
    const user = getUser(event);
    requireRole(user, ...ALL_ROLES);

    const body = parseBody(event);
    requireFields(body, ['contentType']);
    const extension = ALLOWED_TYPES[body.contentType];
    if (!extension) {
        throw fail.badRequest('Type de fichier non autorisé', { allowed: Object.keys(ALLOWED_TYPES) });
    }

    const key = `uploads/${user.id}/${randomUUID()}${extension}`;
    const uploadUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket: process.env.MEDIA_BUCKET, Key: key, ContentType: body.contentType }),
        { expiresIn: EXPIRES_IN }
    );

    return ok({
        uploadUrl,
        method: 'PUT',
        headers: { 'Content-Type': body.contentType },
        key,
        mediaPath: `/media/${key}`,
        expiresIn: EXPIRES_IN,
    });
});