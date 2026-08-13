fetch('https://jsonlink.io/api/extract?url=https://www.instagram.com/reel/C8qL8Zsoq6n/').then(r => r.json()).then(t => console.log(JSON.stringify(t))).catch(e => console.log('Error', e));
