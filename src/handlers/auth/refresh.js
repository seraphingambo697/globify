const { InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { ok } = require('../../lib/response');
const { wrap } = require('../../lib/http');
const { parseBody, requireFields } = require('../../lib/validate');
const { cognito, cognitoError, CLIENT_ID } = require('../../lib/cognito');

// POST /auth/refresh (public) : nouveau token à partir du refreshToken
exports.handler = wrap(async (event) => {
    const body = parseBody(event);
    requireFields(body, ['refreshToken']);

    let result;
    try {
        result = await cognito.send(
            new InitiateAuthCommand({
                ClientId: CLIENT_ID,
                AuthFlow: 'REFRESH_TOKEN_AUTH',
                AuthParameters: { REFRESH_TOKEN: String(body.refreshToken) },
            })
        );
    } catch (err) {
        throw cognitoError(err);
    }

    const auth = result.AuthenticationResult;
    return ok({
        idToken: auth.IdToken,
        accessToken: auth.AccessToken,
        expiresIn: auth.ExpiresIn,
        tokenType: 'Bearer',
    });
});