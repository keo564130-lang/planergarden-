const fs = require('fs');
async function testDdInsta() {
  const res = await fetch('https://www.ddinstagram.com/reel/C-M-Zq3t8yO/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();
  const title = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
  const desc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
  console.log('Title:', title ? title[1] : 'none');
  console.log('Desc:', desc ? desc[1].substring(0,50) : 'none');
}
testDdInsta();
