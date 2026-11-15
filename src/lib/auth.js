// Utilisateur connecté et contrôle des rôles (RBAC)
const { fail } = require('./http');

const ROLES = {
    ADMIN: 'admin',
    EDITOR: 'editor',
    GUEST: 'guest_author',
};
const ALL_ROLES = Object.values(ROLES);

// API Gateway peut fournir les groupes sous forme "admin", "admin,editor" ou "[admin, editor]"
const parseGroups = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return String(raw)
        .replace(/[[\]]/g, '')
        .split(/[,\s]+/)
        .filter(Boolean);
};

const getUser = (event) => {
    const claims = event.requestContext?.authorizer?.claims;
    if (!claims || !claims.sub) throw fail.unauthorized();
    return {
        id: claims.sub,
        email: claims.email,
        name: claims.name || (claims.email ? claims.email.split('@')[0] : 'anonyme'),
        groups: parseGroups(claims['cognito:groups']),
    };
};

const hasRole = (user, ...roles) => roles.some((r) => user.groups.includes(r));

const requireRole = (user, ...roles) => {
    if (!hasRole(user, ...roles)) {
        throw fail.forbidden(`Rôle requis : ${roles.join(' ou ')}`);
    }
};

module.exports = { ROLES, ALL_ROLES, parseGroups, getUser, hasRole, requireRole };