const express = require('express');
const router = express.Router();

const PRIMARY_URL = process.env.AGENT_BACKEND_URL || 'http://127.0.0.1:8001/api/agent';
const FALLBACK_URL = 'http://127.0.0.1:8000/api/agent';

// Forward all /api/agent requests to the Python FastAPI agent service (supports both port 8001 and 8000)
router.all('*', async (req, res) => {
  const tryFetch = async (baseUrl) => {
    const targetUrl = `${baseUrl}${req.url}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      options.body = JSON.stringify(req.body);
    }

    try {
      const response = await fetch(targetUrl, options);
      const contentType = response.headers.get('content-type') || '';
      const body = contentType.includes('application/json')
        ? await response.json()
        : await response.text();
      return { status: response.status, contentType, body };
    } finally {
      clearTimeout(timeout);
    }
  };

  const agentUrls = [...new Set([PRIMARY_URL, FALLBACK_URL])];
  let lastError;
  for (let index = 0; index < agentUrls.length; index += 1) {
    try {
      const result = await tryFetch(agentUrls[index]);
      const shouldTryFallback = index < agentUrls.length - 1 &&
        (result.status === 404 || result.status >= 500);
      if (shouldTryFallback) continue;

      if (result.contentType.includes('application/json')) {
        return res.status(result.status).json(result.body);
      }
      return res.status(result.status).send(result.body);
    } catch (err) {
      lastError = err;
      console.warn(`[Agent Proxy] ${agentUrls[index]} did not respond: ${err.message}`);
    }
  }

  console.error('[Agent Proxy Error] No agent service responded:', lastError?.message);
  return res.status(502).json({
    success: false,
    error: 'Agent service is currently unreachable. Ensure Python agent server is running on port 8001 or 8000.',
    detail: lastError?.message || 'Both configured agent endpoints returned an error.',
  });
});

module.exports = router;
