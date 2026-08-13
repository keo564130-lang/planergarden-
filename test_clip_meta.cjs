const fs = require('fs');
const html = fs.readFileSync('vk_clip_test.html', 'utf8');
const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i) || 
                     html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
console.log('OG Title:', ogTitleMatch ? ogTitleMatch[1] : 'none');

const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) || 
                  html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
console.log('Meta Desc:', descMatch ? descMatch[1] : 'none');
