exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return respond(405, { valid: false });
  }

  try {
    const { code } = JSON.parse(event.body || '{}');
    const valid = typeof code === 'string' &&
                  code.length > 0 &&
                  code === process.env.ADMIN_CODE;

    return respond(200, { valid });
  } catch (_) {
    return respond(400, { valid: false });
  }
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
