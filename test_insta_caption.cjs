const fs = require('fs');
const html = fs.readFileSync('insta.html', 'utf8');

// The caption in Instagram's JSON is usually in "text":"..." inside an object with "node":{"text":
// Or simply look for a very long string.
const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
let found = false;
if (scripts) {
  scripts.forEach((s) => {
    if (s.includes('edge_media_to_caption') || s.includes('"caption":')) {
      console.log('Found caption in script! Length:', s.length);
      found = true;
    }
  });
}
if (!found) {
  console.log('Caption not found in scripts');
}
