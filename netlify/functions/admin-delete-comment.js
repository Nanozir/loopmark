// Server-side admin delete for comments.
// Requires ADMIN_TOKEN to be set in Netlify env vars. Send the token in the
// `x-admin-token` request header. The token is never sent to the browser.
//
// Also requires SUPABASE_SERVICE_ROLE_KEY (the service-role key, NOT the
// anon key) so we can bypass RLS for legitimate moderation. Keep this key
// in env vars and rotate it if it leaks.

const { guardedHandler } = require('./_lib');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

exports.handler = guardedHandler(async (body, event) => {
  if (!ADMIN_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { statusCode: 503, body: { error: 'Admin tools are not configured.' } };
  }

  const provided = event.headers['x-admin-token'] || event.headers['X-Admin-Token'] || '';
  if (provided !== ADMIN_TOKEN) {
    return { statusCode: 401, body: { error: 'Unauthorized' } };
  }

  const { id } = body;
  if (!id || typeof id !== 'string') {
    return { statusCode: 400, body: { error: 'Invalid comment id' } };
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/comments?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Prefer': 'return=minimal'
    }
  });

  if (!res.ok) {
    return { statusCode: 502, body: { error: 'Delete failed', status: res.status } };
  }
  return { statusCode: 200, body: { ok: true } };
});
