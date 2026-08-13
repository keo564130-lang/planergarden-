async function fetchTgHtml() {
  const res = await fetch('https://t.me/telegram/123?embed=1', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await res.text();
  require('fs').writeFileSync('tg.html', html);
}
fetchTgHtml();
