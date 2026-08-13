async function test() {
  const url = 'https://vk.com/wall-212711849_12'; 
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }})
  const html = await r.text()
  console.log("HTML length:", html.length);
  const m = html.match(/og:image['\"][^>]*content=['\"]([^'\"]*)['\"]/i)
  const m2 = html.match(/content=['\"]([^'\"]*)['\"][^>]*og:image/i)
  console.log("Found:", m ? m[1] : (m2 ? m2[1] : 'No image'));
}
test();
