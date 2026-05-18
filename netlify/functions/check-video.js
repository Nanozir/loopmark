const youtubedl = require('youtube-dl-exec');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { url } = JSON.parse(event.body);

    // Ask yt-dlp to grab the metadata (dumpSingleJson) WITHOUT downloading the massive video
    const output = await youtubedl(url, { dumpSingleJson: true, noWarnings: true });
    
    // Check if any of the available video formats have a height of 2160 (4K)
    const formats = output.formats || [];
    const has4K = formats.some(f => f.height === 2160 || f.height > 1080);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        has4K: has4K, 
        title: output.title 
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, error: "Could not read video data from YouTube." })
    };
  }
};