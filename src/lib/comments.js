// Modèle "Commentaire"
const COMMENT_STATUSES = ['pending', 'approved', 'rejected'];


const commentKey = (postId, commentId) => ({ PK: `POST#${postId}`, SK: `COMMENT#${commentId}` });

// eslint-disable-next-line no-unused-vars
const toPublicComment = ({ PK, SK, GSI2PK, GSI2SK, type, ...rest }) => rest;

module.exports = { COMMENT_STATUSES, commentKey, toPublicComment };