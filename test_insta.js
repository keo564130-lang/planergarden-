const fs = require('fs');
const html = fs.readFileSync('insta.html', 'utf8');
const imgMatch = html.match(/<img[^>]*class="EmbeddedMediaImage"[^>]*src="([^"]+)"/i);
const vidMatch = html.match(/<video[^>]*class="EmbeddedMediaVideo"[^>]*src="([^"]+)"/i);
const descMatch = html.match(/<div class="Caption"[^>]*>([\s\S]*?)<\/div>/i);

console.log('Thumbnail:', imgMatch ? imgMatch[1].replace(/&amp;/g, '&') : 'none');
console.log('Video:', vidMatch ? vidMatch[1].replace(/&amp;/g, '&') : 'none');
console.log('Desc:', descMatch ? descMatch[1] : 'none');
