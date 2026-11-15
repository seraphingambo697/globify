const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const sns = new SNSClient({});

const toAscii = (s) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '').trim();

// Déclenchée par DynamoDB Streams
// Envoie un email aux abonnés quand un article passe au statut "published"
exports.handler = async (event) => {
    const failures = [];

    for (const record of event.Records) {
        try {
            const newImage = record.dynamodb?.NewImage ? unmarshall(record.dynamodb.NewImage) : null;
            const oldImage = record.dynamodb?.OldImage ? unmarshall(record.dynamodb.OldImage) : null;

            if (!newImage || newImage.type !== 'POST' || newImage.status !== 'published') continue;
            if (oldImage && oldImage.status === 'published') continue;

            const subject = toAscii(`Blogify - Nouvel article : ${newImage.title}`).slice(0, 99);
            const message = [
                `Nouvel article sur Blogify : ${newImage.title}`,
                '',
                newImage.excerpt || '',
                '',
                `Par ${newImage.authorName}`,
                `Lire l'article : ${process.env.API_URL}/posts/${newImage.id}`,
            ].join('\n');

            await sns.send(
                new PublishCommand({ TopicArn: process.env.TOPIC_ARN, Subject: subject || 'Blogify', Message: message })
            );
            console.log(JSON.stringify({ level: 'INFO', message: 'Notification envoyée', postId: newImage.id }));
        } catch (err) {
            console.error(JSON.stringify({ level: 'ERROR', message: err.message, sequence: record.dynamodb?.SequenceNumber }));
            failures.push({ itemIdentifier: record.dynamodb?.SequenceNumber });
        }
    }

    return { batchItemFailures: failures };
};