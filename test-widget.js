import fs from 'fs';
const html = fs.readFileSync('vk_m_test.html', 'utf8');

const vkTextMatch = html.match(/<div[^>]*data-testid=["']wall_post_text["'][^>]*>([\s\S]*?)<\/div>/i) || 
                    html.match(/<div[^>]*class=["'][^"']*wall_post_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                    html.match(/<div[^>]*class=["'][^"']*pi_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
if (vkTextMatch) console.log('Text:', vkTextMatch[1].substring(0, 100)); else console.log('Text not found');

const imgMatch = html.match(/<div[^>]*class=["'][^"']*page_post_sized_thumbs[^"']*["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i) ||
                 html.match(/<a[^>]*class=["'][^"']*page_post_thumb_wrap[^"']*["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i);
if (imgMatch) console.log('Image:', imgMatch[1]); else console.log('Image not found');
