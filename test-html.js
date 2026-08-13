async function test() {
  const url = 'https://vk.com/wall-212711849_12'; 
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }})
  const buffer = await r.arrayBuffer()
  const decoder = new TextDecoder('windows-1251')
  const html = decoder.decode(buffer)
  
  const idx = html.lastIndexOf('Хочу на пробное');
  if (idx > -1) {
      console.log(html.substring(idx - 600, idx));
  }
}
test();
