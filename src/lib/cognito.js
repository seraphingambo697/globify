// Client Cognito partagé + traduction des erreurs Cognito en erreurs HTTP
const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
const { HttpError } = require('./http');

const cognito = new CognitoIdentityProviderClient({});

const ERRORS = {
    UsernameExistsException: [409, 'UserExists', 'Un compte existe déjà avec cet email'],
    InvalidPasswordException: [400, 'InvalidPassword', 'Mot de passe trop faible : 8 caractères minimum, avec une majuscule, une minuscule et un chiffre'],
    InvalidParameterException: [400, 'InvalidParameter', null],
    CodeMismatchException: [400, 'InvalidCode', 'Code de confirmation invalide'],
    ExpiredCodeException: [400, 'ExpiredCode', 'Code de confirmation expiré'],
    NotAuthorizedException: [401, 'NotAuthorized', null],
    UserNotFoundException: [401, 'NotAuthorized', 'Email ou mot de passe incorrect'],
    UserNotConfirmedException: [403, 'UserNotConfirmed', 'Compte non confirmé : validez le code reçu par email'],
    TooManyRequestsException: [429, 'TooManyRequests', 'Trop de tentatives, réessayez plus tard'],
    LimitExceededException: [429, 'TooManyRequests', 'Trop de tentatives, réessayez plus tard'],
};

const cognitoError = (err) => {
    const mapping = ERRORS[err.name];
    if (!mapping) return err;
    const [status, code, message] = mapping;
    return new HttpError(status, code, message || err.message);
};

module.exports = {
    cognito,
    cognitoError,
    USER_POOL_ID: process.env.USER_POOL_ID,
    CLIENT_ID: process.env.USER_POOL_CLIENT_ID,
};