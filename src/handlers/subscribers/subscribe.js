const { SNSClient, SubscribeCommand } = require('@aws-sdk/client-sns');
const { accepted } = require('../../lib/response');
const { wrap, fail } = require('../../lib/http');
const { parseBody, requireFields, isEmail } = require('../../lib/validate');

const sns = new SNSClient({});

// POST /subscribe: abonne un email aux nouveaux articles
exports.handler = wrap(async (event) => {
    const body = parseBody(event);
    requireFields(body, ['email']);
    const email = String(body.email).trim().toLowerCase();
    if (!isEmail(email)) throw fail.badRequest('Email invalide');

    await sns.send(
        new SubscribeCommand({
            TopicArn: process.env.TOPIC_ARN,
            Protocol: 'email',
            Endpoint: email,
        })
    );

    return accepted({
        email,
        message: "Un email de confirmation vient d'être envoyé. Cliquez sur le lien pour activer l'abonnement.",
    });
});