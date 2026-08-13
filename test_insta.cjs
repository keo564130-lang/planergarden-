async function testInsta() {
  const res = await fetch('https://www.instagram.com/reel/C-M-Zq3t8yO/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();
  require('fs').writeFileSync('insta.html', html);
  console.log('Saved insta.html', html.length);
}
testInsta();
