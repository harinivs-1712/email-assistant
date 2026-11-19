const express = require('express');
const router = express.Router();

const PRIMARY_URL = process.env.AGENT_BACKEND_URL || 'http://127.0.0.1:8001/api/agent';
const FALLBACK_URL = 'http://127.0.0.1:8000/api/agent';

// Forward all /api/agent requests to the Python FastAPI agent service (supports both port 8001 and 8000)
router.all('*', async (req, res) => {
  const tryFetch = async (baseUrl) => {
    const targetUrl = `${baseUrl}${req.url}`;
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      options.body = JSON.stringify(req.body);
    }

    return fetch(targetUrl, options);
  };

  try {
    let response;
    try {
      response = await tryFetch(PRIMARY_URL);
    } catch (e1) {
      if (PRIMARY_URL !== FALLBACK_URL) {
        response = await tryFetch(FALLBACK_URL);
      } else {
        throw e1;
      }
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (err) {
    console.error(`[Agent Proxy Error] Failed to reach agent service:`, err.message);
    return res.status(502).json({
      success: false,
      error: 'Agent service is currently unreachable. Ensure Python agent server is running on port 8001 or 8000.',
      detail: err.message,
    });
  }
});

module.exports = router;
