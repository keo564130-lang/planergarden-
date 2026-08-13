const fs = require('fs');
const html = fs.readFileSync('real_clip.html', 'utf8');
const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) || 
                  html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
console.log('Meta Desc:', descMatch ? descMatch[1].substring(0, 100) : 'none');
