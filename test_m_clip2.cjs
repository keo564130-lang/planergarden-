async function getClip() {
  const res = await fetch('https://m.vk.com/clip-204128542_456241315', {
    headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)' }
  });
  const html = await res.text();
  console.log('length:', html.length);
  // Just dump everything to a file to manually grep
  require('fs').writeFileSync('m_clip.html', html);
}
getClip().catch(console.error);
