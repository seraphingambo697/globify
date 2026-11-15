// Pagination : on transforme la "LastEvaluatedKey" de DynamoDB en jeton opaque 
const { fail } = require('./http');

const encodeCursor = (key) =>
    key ? Buffer.from(JSON.stringify(key)).toString('base64url') : null;

const decodeCursor = (token) => {
    if (!token) return undefined;
    try {
        return JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    } catch {
        throw fail.badRequest('nextToken invalide');
    }
};

module.exports = { encodeCursor, decodeCursor };