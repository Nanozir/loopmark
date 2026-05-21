// Shared helpers for Netlify functions.

// Hosts allowed to call our functions. Keep in sync with netlify deploy domains.
const ALLOWED_ORIGINS = new Set([
  'https://loopmark.se',
  'https://www.loopmark.se',
  // The Netlify-generated preview domain. Tighten if you don't want previews to call live functions.
  /^https:\/\/[a-z0-9-]+--loopmark\.netlify\.app$/,
  // Local dev
  'http://localhost:8888',
  'http://localhost:5173',
  'http://localhost:3000'
]);

function originAllowed(origin) {
  if (!origin) return false;
  for (const entry of ALLOWED_ORIGINS) {
    if (typeof entry === 'string' && entry === origin) return true;
    if (entry instanceof RegExp && entry.test(origin)) return true;
  }
  return false;
}

function corsHeaders(origin) {
  const allowed = originAllowed(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://loopmark.se',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

// Wraps a handler with: CORS, origin check, OPTIONS preflight, and JSON body parsing.
function guardedHandler(fn) {
  return async (event) => {
    const origin = event.headers.origin || event.headers.Origin || '';
    const headers = corsHeaders(origin);

    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers, body: '' };
    }
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }
    if (!originAllowed(origin)) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Origin not allowed' }) };
    }

    let body = {};
    try { body = event.body ? JSON.parse(event.body) : {}; }
    catch (_) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    try {
      const result = await fn(body, event);
      return {
        statusCode: result.statusCode || 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: typeof result.body === 'string' ? result.body : JSON.stringify(result.body || {})
      };
    } catch (err) {
      // Don't leak internal error messages to clients
      console.error(err);
      return {
        statusCode: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal error' })
      };
    }
  };
}

// Crude in-memory IP rate limiter. NOT durable across invocations on serverless;
// use Upstash / Supabase / Redis for real durable limiting in production.
const rateBuckets = new Map();
function rateLimit(ip, { windowMs = 60_000, max = 10 } = {}) {
  const now = Date.now();
  const arr = (rateBuckets.get(ip) || []).filter(t => now - t < windowMs);
  arr.push(now);
  rateBuckets.set(ip, arr);
  return arr.length <= max;
}

module.exports = { guardedHandler, rateLimit, originAllowed };
