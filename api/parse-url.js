// Vercel serverless function: extract og:tags from any URL
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL required' })

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html',
        'Accept-Language': 'ru-RU,ru;q=0.9'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    })

    if (!response.ok) {
      return res.status(422).json({ error: `Failed to fetch: ${response.status}` })
    }

    const html = await response.text()
    
    // Extract Open Graph tags
    const getOg = (property) => {
      const regex = new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']*)["']`, 'i')
      const match = html.match(regex)
      if (match) return decodeHtmlEntities(match[1])
      // Try reverse order (content before property)
      const regex2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${property}["']`, 'i')
      const match2 = html.match(regex2)
      return match2 ? decodeHtmlEntities(match2[1]) : ''
    }

    // Also try regular meta tags
    const getMeta = (name) => {
      const regex = new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i')
      const match = html.match(regex)
      if (match) return decodeHtmlEntities(match[1])
      const regex2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`, 'i')
      const match2 = html.match(regex2)
      return match2 ? decodeHtmlEntities(match2[1]) : ''
    }

    // Get title from <title> tag as fallback
    const getTitleTag = () => {
      const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      return match ? decodeHtmlEntities(match[1].trim()) : ''
    }

    const title = getOg('title') || getMeta('title') || getTitleTag()
    const description = getOg('description') || getMeta('description') || ''
    const image = getOg('image') || ''

    return res.status(200).json({
      title,
      description,
      image,
      source: url
    })

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to parse URL' })
  }
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)))
}
