const fs = require('fs');
async function test() {
  const res = await fetch('https://vk.com/clip-223788510_456240822');
  const html = await res.text();
  const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) || 
               html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
  console.log('OG Desc:', ogDesc ? ogDesc[1].substring(0, 50) : 'none');
}
test();
