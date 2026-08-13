const formData = new URLSearchParams();
formData.append('q', 'https://www.instagram.com/reel/C8qL8Zsoq6n/');
formData.append('t', 'media');
formData.append('lang', 'en');

fetch('https://v3.saveig.app/api/ajaxSearch', {
  method: 'POST',
  body: formData,
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Origin': 'https://saveig.app',
    'Referer': 'https://saveig.app/en'
  }
}).then(r => r.json()).then(t => console.log(t)).catch(e => console.log('Error', e));
