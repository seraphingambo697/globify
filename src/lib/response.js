
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

