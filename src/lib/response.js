
const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
};

const json = (statusCode, body) => ({
    statusCode,
    headers,
    body: JSON.stringify(body),
});

const error = (statusCode, code, message, details) =>
    json(statusCode, { error: code, message, ...(details && { details }) });

module.exports = {
    ok: (body) => json(200, body),
    created: (body) => json(201, body),
    noContent: () => ({ statusCode: 204, headers, body: '' }),
    badRequest: (message, details) => error(400, 'BadRequest', message, details),
    unauthorized: (message = 'Non authentifié') => error(401, 'Unauthorized', message),
    forbidden: (message = 'Accès refusé') => error(403, 'Forbidden', message),
    notFound: (message = 'Ressource introuvable') => error(404, 'NotFound', message),
    serverError: (message = 'Erreur interne') => error(500, 'InternalError', message),
};