const url = 'https://www.instagram.com/reel/C8qL8Zsoq6n/embed/';
fetch(url).then(r => r.text()).then(t => {
  const titleMatch = t.match(/<title>([\s\S]*?)<\/title>/i);
  const imgMatch = t.match(/<img[^>]*src=["']([^"']+)["']/i);
  console.log("TITLE:", titleMatch ? titleMatch[1] : null);
  console.log("IMG:", imgMatch ? imgMatch[1] : null);
});
