// Gestion centralisée des erreurs pour toutes les Lambdas
const response = require('./response');

// Erreur "métier" : on la lance (throw) et wrap() la transforme en réponse HTTP
class HttpError extends Error {
    constructor(statusCode, code, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

// Raccourcis pour créer les erreurs courantes
const fail = {
    badRequest: (message, details) => new HttpError(400, 'BadRequest', message, details),
    unauthorized: (message = 'Non authentifié') => new HttpError(401, 'Unauthorized', message),
    forbidden: (message = 'Accès refusé') => new HttpError(403, 'Forbidden', message),
    notFound: (message = 'Ressource introuvable') => new HttpError(404, 'NotFound', message),
    conflict: (message = 'Conflit') => new HttpError(409, 'Conflict', message),
    tooMany: (message = 'Trop de requêtes, réessayez plus tard') =>
        new HttpError(429, 'TooManyRequests', message),
};

// Enveloppe erreur devient une réponse JSON 
const wrap = (fn) => async (event, context) => {
    try {
        return await fn(event, context);
    } catch (err) {
        if (err instanceof HttpError) {
            return response.error(err.statusCode, err.code, err.message, err.details);
        }
        if (err.name === 'ConditionalCheckFailedException') {
            return response.error(409, 'Conflict', 'La ressource a été modifiée entre-temps, réessayez');
        }

        console.error(JSON.stringify({ level: 'ERROR', name: err.name, message: err.message, stack: err.stack }));
        return response.serverError();
    }
};

module.exports = { HttpError, fail, wrap };