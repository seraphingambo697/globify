const { SignUpCommand, AdminAddUserToGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { created } = require('../../lib/response');
const { wrap, fail } = require('../../lib/http');
const { parseBody, requireFields, isEmail, checkString } = require('../../lib/validate');
const { cognito, cognitoError, USER_POOL_ID, CLIENT_ID } = require('../../lib/cognito');
const { ROLES } = require('../../lib/auth');

// POST /auth/signup (public) : inscription, =
exports.handler = wrap(async (event) => {
    const body = parseBody(event);
    requireFields(body, ['email', 'password']);

    const email = String(body.email).trim().toLowerCase();
    if (!isEmail(email)) throw fail.badRequest('Email invalide');

    const attributes = [{ Name: 'email', Value: email }];
    if (body.name) attributes.push({ Name: 'name', Value: checkString(body.name, 100, 'name') });

    let result;
    try {
        result = await cognito.send(
            new SignUpCommand({
                ClientId: CLIENT_ID,
                Username: email,
                Password: String(body.password),
                UserAttributes: attributes,
            })
        );

        await cognito.send(
            new AdminAddUserToGroupCommand({
                UserPoolId: USER_POOL_ID,
                Username: email,
                GroupName: ROLES.GUEST,
            })
        );
    } catch (err) {
        throw cognitoError(err);
    }

    return created({
        userId: result.UserSub,
        email,
        role: ROLES.GUEST,
        confirmed: result.UserConfirmed,
        message: 'Compte créé. Un code de confirmation a été envoyé par email.',
    });
});