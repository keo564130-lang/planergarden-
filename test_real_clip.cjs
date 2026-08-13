const fs = require('fs');
const html = fs.readFileSync('real_clip.html', 'utf8');

const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) || 
               html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
console.log('OG Desc:', ogDesc ? ogDesc[1].substring(0, 50) : 'none');

const jsonMatch = html.match(/"text":\s*"([^"]+)"/g);
if (jsonMatch) {
  jsonMatch.forEach(m => console.log('JSON Text:', m.substring(0, 100)));
} else {
  console.log('No JSON text found');
}
