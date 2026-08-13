async function testTg2() {
  const res = await fetch('https://t.me/telegram/123?embed=1', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await res.text();
  const img = html.match(/<a[^>]*class=["'][^"']*tgme_widget_message_photo_wrap[^"']*["'][^>]*style=["']background-image:url\(['"]?([^'"]+)['"]?\)/i);
  console.log('Img:', img ? img[1] : 'none');
}
testTg2();
