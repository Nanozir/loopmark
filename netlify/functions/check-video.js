// Probes a YouTube URL for available formats.
//
// IMPORTANT: youtube-dl-exec spawns the `yt-dlp` Python binary, which is NOT
// available in the default Netlify Functions runtime. This function is left
// here as a starting point but will fail at runtime on Netlify until you
// either (a) run yt-dlp on a long-running host (Fly.io / Railway / Render /
// a VPS) and proxy from here, or (b) ship yt-dlp via a Lambda layer.
// See IMPROVEMENTS.md for the full migration plan.

const { guardedHandler, rateLimit } = require('./_lib');
let youtubedl;
try { youtubedl = require('youtube-dl-exec'); } catch (_) { youtubedl = null; }

exports.handler = guardedHandler(async (body, event) => {
  const ip = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  if (!rateLimit(ip, { windowMs: 60_000, max: 6 })) {
    return { statusCode: 429, body: { error: 'Too many requests' } };
  }

  const { url } = body;
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return { statusCode: 400, body: { error: 'Invalid url' } };
  }
  if (!/youtu\.?be/i.test(url)) {
    return { statusCode: 400, body: { error: 'Only YouTube URLs are supported' } };
  }

  if (!youtubedl) {
    return {
      statusCode: 503,
      body: { error: 'Video probing is temporarily unavailable. See README for setup.' }
    };
  }

  try {
    const output = await youtubedl(url, { dumpSingleJson: true, noWarnings: true });
    const formats = output.formats || [];
    const has4K = formats.some(f => f && (f.height === 2160 || (f.height && f.height > 1080)));
    return {
      statusCode: 200,
      body: { success: true, has4K, title: output.title || '' }
    };
  } catch (_) {
    return {
      statusCode: 400,
      body: { success: false, error: 'Could not read video data from YouTube.' }
    };
  }
});
