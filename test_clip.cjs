const fs = require('fs');
const html = fs.readFileSync('vk_clip_test.html', 'utf8');
const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) || 
                    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
const ogDesc = ogDescMatch ? ogDescMatch[1] : '';
console.log('OG Desc:', ogDesc);

const matches = html.match(/class="[^"]*description[^"]*"/gi);
console.log('Description classes:', new Set(matches));

const clipDesc = html.match(/<div[^>]*class=["'][^"']*vkuiSpacing[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                 html.match(/<div[^>]*class=["'][^"']*clip_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
if (clipDesc) {
    console.log('Clip text div found:', clipDesc[0].substring(0, 100));
}

// Just find ALL divs that have a lot of text
const divMatches = html.match(/<div[^>]*>([\s\S]{100,5000})<\/div>/g);
if (divMatches) {
    const textDivs = divMatches.filter(d => d.includes(ogDesc.substring(0, 10)));
    if (textDivs.length > 0) {
        console.log('Found full text div match:', textDivs[0].substring(0, 200));
    } else {
        console.log('No div matches ogDesc text');
    }
}
