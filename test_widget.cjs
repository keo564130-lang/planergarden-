const fs = require('fs');
const html = fs.readFileSync('vk_widget.html', 'utf8');
const textMatch = html.match(/<div[^>]*class=["'][^"']*post_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                  html.match(/<div[^>]*class=["'][^"']*pi_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
console.log(textMatch ? textMatch[1].substring(0, 500) : 'no text found');
