const fs = require('fs');
const html = fs.readFileSync('tg.html', 'utf8');

// find all tags with background-image
const tags = html.match(/<[^>]*background-image[^>]*>/gi);
console.log(tags);
