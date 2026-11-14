
const { ok } = require('../lib/response');

exports.handler = async () =>
    ok({
        status: 'ok',
        service: 'blogify',
        stage: process.env.STAGE,
        timestamp: new Date().toISOString(),
    });