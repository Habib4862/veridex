const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return respond(405, { error: 'Method Not Allowed' });
  }

  const jobId = event.queryStringParameters?.jobId;
  if (!jobId) {
    return respond(400, { error: 'jobId requerido' });
  }

  try {
    const store = getStore('jobs');
    const job = await store.get(jobId, { type: 'json' });

    return respond(200, job ?? { status: 'pending' });
  } catch (e) {
    console.error('poll error:', e);
    return respond(500, { error: e.message || 'Error interno' });
  }
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}
