const { ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { ok } = require('../../lib/response');
const { wrap } = require('../../lib/http');
const { getUser, requireRole, ROLES } = require('../../lib/auth');
const { cognito, USER_POOL_ID } = require('../../lib/cognito');

const attr = (user, name) => user.Attributes?.find((a) => a.Name === name)?.Value ?? null;

// GET /users (admin) : liste les utilisateurs
exports.handler = wrap(async (event) => {
    requireRole(getUser(event), ROLES.ADMIN);

    const res = await cognito.send(
        new ListUsersCommand({
            UserPoolId: USER_POOL_ID,
            Limit: 60,
            PaginationToken: event.queryStringParameters?.nextToken,
        })
    );

    return ok({
        items: (res.Users || []).map((u) => ({
            id: attr(u, 'sub'),
            email: attr(u, 'email'),
            name: attr(u, 'name'),
            status: u.UserStatus,
            enabled: u.Enabled,
            createdAt: u.UserCreateDate,
        })),
        nextToken: res.PaginationToken || null,
    });
});