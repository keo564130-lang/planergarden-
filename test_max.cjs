const fs = require('fs');
const html = fs.readFileSync('max.html', 'utf8');
const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i);
const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/i);
const ogImg = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i);

console.log('OG title:', ogTitle ? ogTitle[1] : 'none');
console.log('OG desc:', ogDesc ? ogDesc[1] : 'none');
console.log('OG img:', ogImg ? ogImg[1] : 'none');

const maxTextMatch = html.match(/message:\s*\{.*?text:\s*"([\s\S]*?[^\\])"\s*[,}]/i);
console.log('Max text:', maxTextMatch ? maxTextMatch[1] : 'none');

const maxImgMatch = html.match(/attachment:.*?url:\s*"([^"]+)"/i);
console.log('Max img:', maxImgMatch ? maxImgMatch[1] : 'none');
