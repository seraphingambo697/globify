const { ok } = require('../lib/response');
const { wrap } = require('../lib/http');
const { getUser } = require('../lib/auth');

// GET /me (protégé) : renvoie l'utilisateur connecté et ses rôles
exports.handler = wrap(async (event) => ok(getUser(event)));