const {
    ListUsersCommand,
    AdminListGroupsForUserCommand,
    AdminAddUserToGroupCommand,
    AdminRemoveUserFromGroupCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { ok } = require('../../lib/response');
const { wrap, fail } = require('../../lib/http');
const { parseBody, requireFields } = require('../../lib/validate');
const { getUser, requireRole, ROLES, ALL_ROLES } = require('../../lib/auth');
const { cognito, USER_POOL_ID } = require('../../lib/cognito');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PUT /users/{id}/role (admin) : change le rôle d'un utilisateur
exports.handler = wrap(async (event) => {
    const admin = getUser(event);
    requireRole(admin, ROLES.ADMIN);

    const targetId = event.pathParameters?.id;
    if (!UUID.test(targetId || '')) throw fail.badRequest('Identifiant utilisateur invalide');
    if (targetId === admin.id) throw fail.badRequest('Vous ne pouvez pas modifier votre propre rôle');

    const body = parseBody(event);
    requireFields(body, ['role']);
    if (!ALL_ROLES.includes(body.role)) {
        throw fail.badRequest(`role doit valoir : ${ALL_ROLES.join(', ')}`);
    }

    const found = await cognito.send(
        new ListUsersCommand({ UserPoolId: USER_POOL_ID, Filter: `sub = "${targetId}"`, Limit: 1 })
    );
    const target = found.Users?.[0];
    if (!target) throw fail.notFound('Utilisateur introuvable');

    const current = await cognito.send(
        new AdminListGroupsForUserCommand({ UserPoolId: USER_POOL_ID, Username: target.Username })
    );
    const currentGroups = (current.Groups || []).map((g) => g.GroupName);

    for (const group of currentGroups) {
        if (group !== body.role && ALL_ROLES.includes(group)) {
            await cognito.send(
                new AdminRemoveUserFromGroupCommand({ UserPoolId: USER_POOL_ID, Username: target.Username, GroupName: group })
            );
        }
    }
    if (!currentGroups.includes(body.role)) {
        await cognito.send(
            new AdminAddUserToGroupCommand({ UserPoolId: USER_POOL_ID, Username: target.Username, GroupName: body.role })
        );
    }

    return ok({
        id: targetId,
        role: body.role,
        message: "Rôle mis à jour. L'utilisateur doit se reconnecter pour que son token reflète le nouveau rôle.",
    });
});