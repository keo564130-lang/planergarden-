const fs = require('fs');
const html = fs.readFileSync('vk_clip_test.html', 'utf8');
const textMatch = html.match(/"text":"(.*?)"/g);
if (textMatch) {
    console.log(textMatch.slice(0, 5).join('\n'));
} else {
    console.log('No text JSON found');
}
