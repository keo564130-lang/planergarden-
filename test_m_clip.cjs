async function getClip() {
  const res = await fetch('https://m.vk.com/clip-204128542_456241315', {
    headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)' }
  });
  const html = await res.text();
  const descMatch = html.match(/"description":\s*"([^"]+)"/);
  console.log(descMatch ? descMatch[1].substring(0, 100) : 'Not found');
  const textMatch = html.match(/"text":\s*"([^"]+)"/);
  console.log('Text match:', textMatch ? textMatch[1].substring(0, 100) : 'Not found');
}
getClip().catch(console.error);
