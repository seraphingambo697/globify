const { InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { ok } = require('../../lib/response');
const { wrap, fail } = require('../../lib/http');
const { parseBody, requireFields } = require('../../lib/validate');
const { cognito, cognitoError, CLIENT_ID } = require('../../lib/cognito');

// POST /auth/login (public) : connexion, renvoie les tokens JWT
exports.handler = wrap(async (event) => {
    const body = parseBody(event);
    requireFields(body, ['email', 'password']);

    let result;
    try {
        result = await cognito.send(
            new InitiateAuthCommand({
                ClientId: CLIENT_ID,
                AuthFlow: 'USER_PASSWORD_AUTH',
                AuthParameters: {
                    USERNAME: String(body.email).trim().toLowerCase(),
                    PASSWORD: String(body.password),
                },
            })
        );
    } catch (err) {
        throw cognitoError(err);
    }

    if (!result.AuthenticationResult) {
        throw fail.forbidden(`Étape supplémentaire requise : ${result.ChallengeName}`);
    }

    const auth = result.AuthenticationResult;
    return ok({
        idToken: auth.IdToken,
        accessToken: auth.AccessToken,
        refreshToken: auth.RefreshToken,
        expiresIn: auth.ExpiresIn,
        tokenType: 'Bearer',
    });
});