const fs = require('fs');
const html = fs.readFileSync('insta.html', 'utf8');
const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i) || html.match(/<title[^>]*>([^<]+)<\/title>/i);
console.log('Title:', titleMatch ? titleMatch[1] : 'none');
const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) || html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
console.log('Desc:', descMatch ? descMatch[1].substring(0, 100) : 'none');
const imgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);
console.log('Img:', imgMatch ? imgMatch[1].substring(0, 100) : 'none');
