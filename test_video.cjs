const fs = require('fs');
async function test() {
  const res = await fetch('https://vk.com/video-223788510_456240822', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
  });
  const html = await res.text();
  const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) || 
               html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
  console.log('OG Desc:', ogDesc ? ogDesc[1].substring(0, 50) : 'none');
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i) || 
               html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
  console.log('OG Title:', ogTitle ? ogTitle[1].substring(0, 50) : 'none');
}
test();
