const { ConfirmSignUpCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { ok } = require('../../lib/response');
const { wrap } = require('../../lib/http');
const { parseBody, requireFields } = require('../../lib/validate');
const { cognito, cognitoError, CLIENT_ID } = require('../../lib/cognito');

// POST /auth/confirm (public) : valide le code reçu par email
exports.handler = wrap(async (event) => {
    const body = parseBody(event);
    requireFields(body, ['email', 'code']);

    try {
        await cognito.send(
            new ConfirmSignUpCommand({
                ClientId: CLIENT_ID,
                Username: String(body.email).trim().toLowerCase(),
                ConfirmationCode: String(body.code).trim(),
            })
        );
    } catch (err) {
        throw cognitoError(err);
    }

    return ok({ message: 'Compte confirmé. Vous pouvez vous connecter.' });
});