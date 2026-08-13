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
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
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

  let { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL required' })

  // For VK Clips, the `/clip` endpoint doesn't return og:tags in the HTML.
  // We rewrite it to `/video` which returns the correct og:description and og:image.
  if (url.includes('vk.com/clip')) {
    url = url.replace('vk.com/clip', 'vk.com/video')
  }

  // For Telegram, we need to use the embed widget to get metadata
  if (url.includes('t.me/') && !url.includes('?embed=1') && !url.includes('&embed=1')) {
    url = url + (url.includes('?') ? '&embed=1' : '?embed=1')
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
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
    
    // Check for VK unsupported browser or bot block
    if (html.includes('This may cause VK to work slowly') || html.includes('Обновите ваш браузер') || html.includes('unsupported browser')) {
      throw new Error('VK blocked the parser (unsupported browser), falling back to microlink')
    }
    
    // Check for Instagram login wall
    if (html.includes('Login • Instagram') || html.includes('Войти • Instagram') || html.includes('instagram.com/accounts/login')) {
      throw new Error('Instagram login wall detected, falling back to microlink')
    }

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
    
    // Clean HTML from description and preserve emojis
    description = description
      .replace(/<img[^>]*class=["'][^"']*emoji[^"']*["'][^>]*alt=["']([^"']+)["'][^>]*>/gi, '$1')
      .replace(/<img[^>]*alt=["']([^"']+)["'][^>]*class=["'][^"']*emoji[^"']*["'][^>]*>/gi, '$1')
      .split('Последние записи:')[0] // Remove VK's recent posts block
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    
    // Telegram specific extraction
    if (url.includes('t.me/')) {
      const tgTextMatch = html.match(/<div[^>]*class=["'][^"']*tgme_widget_message_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
      if (tgTextMatch && tgTextMatch[1]) {
        let tgText = tgTextMatch[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
        description = decodeEntities(tgText).trim()
      }
      if (!title || title.toLowerCase() === 'telegram') {
        const tgAuthorMatch = html.match(/<span[^>]*class=["'][^"']*tgme_widget_message_owner_name[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) ||
                              html.match(/<a[^>]*class=["'][^"']*tgme_widget_message_owner_name[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)
        if (tgAuthorMatch && tgAuthorMatch[1]) {
          title = decodeEntities(tgAuthorMatch[1].replace(/<[^>]+>/g, '').trim())
        } else {
          title = 'Telegram'
        }
      }
    }

    let image = getOg('image') || ''

    if (url.includes('t.me/')) {
      const tgImgRegex1 = /class=["'][^"']*(?:tgme_widget_message_photo_wrap|tgme_widget_message_video_thumb|link_preview_image|tgme_widget_message_photo_image)[^"']*["'][^>]*style=["'][^"']*background-image:url\(['"]?([^'"]+)['"]?\)/i
      const tgImgRegex2 = /style=["'][^"']*background-image:url\(['"]?([^'"]+)['"]?\)[^"']*["'][^>]*class=["'][^"']*(?:tgme_widget_message_photo_wrap|tgme_widget_message_video_thumb|link_preview_image|tgme_widget_message_photo_image)[^"']*["']/i
      const tgImgMatch = html.match(tgImgRegex1) || html.match(tgImgRegex2)
      if (tgImgMatch && tgImgMatch[1]) {
        image = decodeEntities(tgImgMatch[1])
      }
    }

    // Instagram specific extraction
    if (url.includes('instagram.com')) {
      // Clean up Instagram title (which sometimes contains the full post)
      if (title) {
        const titleMatch = title.match(/^(.*?)\s*(?:on Instagram|в Instagram|от .*? г\.)/i)
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim()
        } else if (title.length > 50) {
          title = 'Instagram Post'
        }
      }

      // Try to find the full caption in ld+json
      let fullCaption = null
      const jsonMatches = html.match(/<script type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)
      if (jsonMatches) {
        for (const m of jsonMatches) {
          try {
            const inner = m.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '')
            const parsed = JSON.parse(inner)
            if (parsed.articleBody) {
              fullCaption = parsed.articleBody
              break
            }
          } catch (e) {}
        }
      }
      
      if (fullCaption) {
        description = decodeEntities(fullCaption).trim()
      } else if (description) {
        // Strip Instagram metadata prefix like "123 likes, 4 comments - username on August 13, 2026: "
        // or Russian "123 отметок «Нравится», 4 комментариев — username в Instagram: "
        const instaRegex = /^[\s\S]*?(?:likes|Нравится)[\s\S]*?(?:comments|комментари)[\s\S]*?(?:-|—)[\s\S]*?:\s*"?([\s\S]*?)"?$/i
        const instaMatch = description.match(instaRegex)
        if (instaMatch && instaMatch[1]) {
          description = instaMatch[1].trim()
        }
      }
    }

    // max.ru specific extraction
    if (url.includes('max.ru/')) {
      const maxTextMatch = html.match(/message:\s*\{.*?text:\s*"([\s\S]*?[^\\])"\s*[,}]/i)
      if (maxTextMatch && maxTextMatch[1]) {
        description = decodeEntities(maxTextMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
      }
      
      const maxImgMatch = html.match(/attachment:.*?url:\s*"([^"]+)"/i)
      if (maxImgMatch && maxImgMatch[1]) {
        image = maxImgMatch[1].replace(/\\u0026/g, '&')
      }
    }

    if (!image) {
      image = getOg('image') || ''
    }
    
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
  if (!str) return ''
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d)))
}
