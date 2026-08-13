const fs = require('fs');
async function test() {
  const res = await fetch('https://vk.com/video-226982330_456246101', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
  });
  const html = await res.text();
  const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
  console.log('OG Desc:', ogDesc ? ogDesc[1].substring(0, 100) : 'none');
  const ogImg = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);
  console.log('OG Image:', ogImg ? ogImg[1].substring(0, 100) : 'none');
}
test();
