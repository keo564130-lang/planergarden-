async function test() {
  const url = 'https://vk.com/wall-212711849_12'; 
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }})
  const buffer = await r.arrayBuffer()
  const decoder = new TextDecoder('windows-1251')
  const html = decoder.decode(buffer)
  
  const m = html.match(/og:image["'][^>]*content=["']([^"']*)["']/i);
  const m2 = html.match(/content=["']([^"']*)["'][^>]*og:image/i);
  console.log("og:image:", m ? m[1] : (m2 ? m2[1] : 'No og:image'));
}
test();
