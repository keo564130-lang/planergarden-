async function testTg() {
  const res = await fetch('https://t.me/telegram/123?embed=1', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await res.text();
  const title = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
  const desc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) ||
               html.match(/<div[^>]*class=["'][^"']*tgme_widget_message_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  console.log('Title:', title ? title[1] : 'none');
  console.log('Desc:', desc ? desc[1].substring(0,100) : 'none');
}
testTg();
