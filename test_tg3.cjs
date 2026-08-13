async function testTgImages() {
  const res = await fetch('https://t.me/telegram/123?embed=1', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await res.text();
  const bgMatch = html.match(/background-image\s*:\s*url\(['"]?([^'"]+)['"]?\)/gi);
  console.log('Background images found:', bgMatch);
  
  const ogImg = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);
  console.log('OG image:', ogImg ? ogImg[1] : 'none');
}
testTgImages();
