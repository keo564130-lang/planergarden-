const fs = require('fs');
const html = fs.readFileSync('vk_clip_test.html', 'utf8');
const ldJsonMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
if (ldJsonMatch) {
  ldJsonMatch.forEach(m => console.log(m.substring(0, 300)));
} else {
  console.log('No ld+json found');
}
