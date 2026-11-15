const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { redirect } = require('../../lib/response');
const { wrap, fail } = require('../../lib/http');

const s3 = new S3Client({});

// GET /media/{key+} (public) : redirige vers une URL de lecture temporaire du fichier
exports.handler = wrap(async (event) => {
    const key = event.pathParameters?.key;
    if (!key || !key.startsWith('uploads/') || key.includes('..')) {
        throw fail.notFound('Média introuvable');
    }

    const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: process.env.MEDIA_BUCKET, Key: key }),
        { expiresIn: 3600 }
    );

    return redirect(url);
});