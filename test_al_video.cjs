async function getClip() {
  const formData = new URLSearchParams();
  formData.append('act', 'show');
  formData.append('al', '1');
  formData.append('video', '-204128542_456241315');

  const res = await fetch('https://vk.com/al_video.php', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: formData.toString()
  });
  
  const text = await res.text();
  console.log('Response length:', text.length);
  require('fs').writeFileSync('vk_al_video.json', text);
}

getClip().catch(console.error);
