// Lecture et validation des données reçues
const { fail } = require('./http');

// Lit le corps JSON de la requête
const parseBody = (event) => {
    if (!event.body) throw fail.badRequest('Corps de requête manquant');
    const raw = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : event.body;
    let body;
    try {
        body = JSON.parse(raw);
    } catch {
        throw fail.badRequest('JSON invalide');
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        throw fail.badRequest('Le corps doit être un objet JSON');
    }
    return body;
};

// Vérifie que les champs obligatoires sont présents et non vides
const requireFields = (obj, fields) => {
    const missing = fields.filter(
        (f) => obj[f] === undefined || obj[f] === null || (typeof obj[f] === 'string' && obj[f].trim() === '')
    );
    if (missing.length) throw fail.badRequest('Champs obligatoires manquants', { missing });
};

// Vérifie qu'une valeur est une chaîne d'une longueur maximale
const checkString = (value, max, field) => {
    if (typeof value !== 'string') throw fail.badRequest(`${field} doit être une chaîne de caractères`);
    if (value.length > max) throw fail.badRequest(`${field} : ${max} caractères maximum`);
    return value.trim();
};

const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Lit le paramètre ?limit= (entre 1 et max)
const parseLimit = (event, defaultValue = 10, max = 50) => {
    const v = parseInt(event.queryStringParameters?.limit, 10);
    if (!v || v < 1) return defaultValue;
    return Math.min(v, max);
};

module.exports = { parseBody, requireFields, checkString, isEmail, parseLimit };