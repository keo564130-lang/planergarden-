// Vercel serverless function: extract og:tags from any URL
// Handles windows-1251 encoding (VK) and proxies images

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Image proxy mode
  if (req.method === 'GET' && req.query.image) {
    try {
      const imgRes = await fetch(req.query.image, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000)
      })
      if (!imgRes.ok) return res.status(404).end()
      
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
      const buffer = Buffer.from(await imgRes.arrayBuffer())
      
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'public, max-age=3600')
      return res.status(200).send(buffer)
    } catch (e) {
      return res.status(500).json({ error: 'Image fetch failed' })
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL required' })

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      signal: AbortSignal.timeout(8000)
    })

    if (!response.ok) {
      return res.status(422).json({ error: `Не удалось загрузить: ${response.status}` })
    }

    // Get raw bytes to handle encoding
    const buffer = Buffer.from(await response.arrayBuffer())
    
    // Detect encoding from Content-Type header
    const contentType = response.headers.get('content-type') || ''
    let charset = 'utf-8'
    const charsetMatch = contentType.match(/charset=([^\s;]+)/i)
    if (charsetMatch) {
      charset = charsetMatch[1].toLowerCase()
    }
    
    // First try to decode as UTF-8 to check meta charset
    let html = buffer.toString('utf-8')
    
    // Check meta charset in HTML
    const metaCharset = html.match(/<meta[^>]*charset=["']?([^"'\s;>]+)/i)
    if (metaCharset) {
      charset = metaCharset[1].toLowerCase()
    }
    
    // Also check http-equiv content-type
    const httpEquiv = html.match(/<meta[^>]*http-equiv=["']?content-type["']?[^>]*content=["'][^"']*charset=([^"'\s;]+)/i)
    if (httpEquiv) {
      charset = httpEquiv[1].toLowerCase()
    }
    
    // Re-decode with correct encoding if not UTF-8
    if (charset !== 'utf-8' && charset !== 'utf8') {
      try {
        const decoder = new TextDecoder(charset)
        html = decoder.decode(buffer)
      } catch (e) {
        // Fallback: try windows-1251 (common for Russian sites)
        try {
          const decoder = new TextDecoder('windows-1251')
          html = decoder.decode(buffer)
        } catch (e2) {
          // Keep UTF-8 version
        }
      }
    }
    
    // Extract Open Graph tags
    const getOg = (property) => {
      // Try property="og:X" content="Y"
      const r1 = new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']*)["']`, 'i')
      const m1 = html.match(r1)
      if (m1) return decodeEntities(m1[1])
      // Try content="Y" property="og:X"
      const r2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${property}["']`, 'i')
      const m2 = html.match(r2)
      return m2 ? decodeEntities(m2[1]) : ''
    }

    const getMeta = (name) => {
      const r1 = new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i')
      const m1 = html.match(r1)
      if (m1) return decodeEntities(m1[1])
      const r2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`, 'i')
      const m2 = html.match(r2)
      return m2 ? decodeEntities(m2[1]) : ''
    }

    const getTitleTag = () => {
      const m = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      return m ? decodeEntities(m[1].trim()) : ''
    }

    const title = getOg('title') || getMeta('title') || getTitleTag()
    let description = getOg('description') || getMeta('description') || ''
    
    // For VK, og:description is often truncated. Try to get the full post text from HTML
    const vkTextMatch = html.match(/<div[^>]*data-testid=["']wall_post_text["'][^>]*>([\s\S]*?)<\/div>/i) || 
                        html.match(/<div[^>]*class=["'][^"']*wall_post_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
                        html.match(/<div[^>]*class=["'][^"']*pi_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    
    if (vkTextMatch && vkTextMatch[1]) {
      description = decodeEntities(vkTextMatch[1])
    }
    
    // Clean HTML from description
    description = description
      .split('Последние записи:')[0] // Remove VK's recent posts block
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    
    let image = getOg('image') || ''
    
    // Fallback for VK images if og:image is missing or broken
    if (!image && url.includes('vk.com')) {
      const imgMatch = html.match(/<div[^>]*class=["'][^"']*page_post_sized_thumbs[^"']*["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i) ||
                       html.match(/<a[^>]*class=["'][^"']*page_post_thumb_wrap[^"']*["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i)
      if (imgMatch && imgMatch[1]) {
        image = decodeEntities(imgMatch[1])
      }
    }
    
    // Make image URL absolute and force HTTPS
    if (image) {
      if (!image.startsWith('http')) {
        const urlObj = new URL(url)
        image = image.startsWith('/') 
          ? `${urlObj.protocol}//${urlObj.host}${image}`
          : `${urlObj.protocol}//${urlObj.host}/${image}`
      }
      if (image.startsWith('http://')) {
        image = image.replace('http://', 'https://')
      }
    }
    
    // Return proxy URL for image to avoid CORS
    const proxyImage = image ? `/api/parse-url?image=${encodeURIComponent(image)}` : ''

    return res.status(200).json({
      title,
      description,
      image: proxyImage,
      originalImage: image,
      source: url
    })

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Ошибка загрузки' })
  }
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d)))
}
