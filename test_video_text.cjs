const fs = require('fs');
async function test() {
  const res = await fetch('https://vk.com/video-223788510_456240822', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
  });
  const html = await res.text();
  const vkTextMatch = html.match(/<div[^>]*data-testid=["']wall_post_text["'][^>]*>([\s\S]*?)<\/div>/i) || 
                      html.match(/<div[^>]*class=["'][^"']*wall_post_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                      html.match(/<div[^>]*class=["'][^"']*pi_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (vkTextMatch) {
    console.log('VK Text found:', vkTextMatch[1].substring(0, 100));
  } else {
    console.log('No wall_post_text found');
  }
}
test();
