const express = require('express');
const router = express.Router();

const AGENT_BACKEND_URL = process.env.AGENT_BACKEND_URL || 'http://127.0.0.1:8000/api/agent';

// Forward all /api/agent requests to the Python FastAPI agent service
router.all('*', async (req, res) => {
  const targetUrl = `${AGENT_BACKEND_URL}${req.url}`;

  try {
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, options);
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (err) {
    console.error(`[Agent Proxy Error] Failed to reach ${targetUrl}:`, err.message);
    return res.status(502).json({
      success: false,
      error: 'Agent service is currently unreachable. Ensure Python agent server is running on port 8000.',
      detail: err.message,
    });
  }
});

module.exports = router;
