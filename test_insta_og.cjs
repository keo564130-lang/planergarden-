const fs = require('fs');
const html = fs.readFileSync('insta.html', 'utf8');
const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
if (descMatch) {
  console.log('Raw OG Desc:', descMatch[1]);
}
