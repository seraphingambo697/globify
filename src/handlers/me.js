const { ok } = require('../lib/response');

exports.handler = async (event) => {
    const claims = event.requestContext.authorizer.claims;

    return ok({
        userId: claims.sub,
        email: claims.email,
        groups: claims['cognito:groups'] || null,
    });
};