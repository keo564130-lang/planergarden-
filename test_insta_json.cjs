const fs = require('fs');
const html = fs.readFileSync('insta.html', 'utf8');

// Find ld+json scripts
const jsonMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
if (jsonMatches) {
  jsonMatches.forEach((m, i) => {
    try {
      const inner = m.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
      const parsed = JSON.parse(inner);
      if (parsed.articleBody) {
        console.log('Found articleBody:', parsed.articleBody.substring(0, 100));
        // write it to a file so I can inspect
        fs.writeFileSync('insta_article_body.txt', parsed.articleBody);
      }
    } catch (e) {}
  });
}

// Find any other script with the text
// Instagram often puts full text in window.__initialDataLoaded(window, {"require":[["NavigationMetrics",...
// Let's just do a regex for the exact text the user might see. We don't know the exact text.
