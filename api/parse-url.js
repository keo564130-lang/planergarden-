// Vercel serverless function: multi-platform video & recipe extractor
// Supports: VK (Video/Clips/Posts), Instagram (Reels/Posts), Pinterest (Pins/Videos), Telegram, Max.ru

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Image proxy mode to bypass CORS
  if (req.method === 'GET' && req.query.image) {
    try {
      const imgRes = await fetch(req.query.image, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Referer': 'https://vk.com/'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000)
      })
      if (!imgRes.ok) return res.status(404).end()
      
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
      const buffer = Buffer.from(await imgRes.arrayBuffer())
      
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'public, max-age=86400')
      return res.status(200).send(buffer)
    } catch (e) {
      return res.status(500).json({ error: 'Image fetch failed' })
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  let { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'URL required' })
  url = url.trim()

  // =========================================================================
  // 1. INSTAGRAM (Reels & Posts)
  // =========================================================================
  if (url.includes('instagram.com') || url.includes('instagr.am')) {
    try {
      const shortcodeMatch = url.match(/(?:reel|reels|p)\/([a-zA-Z0-9_-]+)/i)
      const shortcode = shortcodeMatch ? shortcodeMatch[1] : encodeURIComponent(url)

      const rapidRes = await fetch(`https://instagram360.p.rapidapi.com/postdetail/?code_or_url=${shortcode}`, {
        headers: {
          'x-rapidapi-key': 'f09a814d17msha5fcec7fa4a0149p1de51djsnfa6510e57f67',
          'x-rapidapi-host': 'instagram360.p.rapidapi.com'
        },
        signal: AbortSignal.timeout(12000)
      })

      if (rapidRes.ok) {
        const rapidData = await rapidRes.json()

        let description = rapidData?.data?.caption?.text || ''
        let image = rapidData?.data?.thumbnail_url || 
                    rapidData?.data?.image_versions?.items?.[0]?.url || 
                    rapidData?.data?.image_versions?.additional_items?.first_frame?.url || 
                    rapidData?.data?.display_url || ''
        let video = rapidData?.data?.video_url || 
                    rapidData?.data?.video_versions?.[0]?.url || ''

        // Fallback recursive search if direct paths missed
        if (!description || !image || !video) {
          function findInstaData(obj) {
            if (!obj || typeof obj !== 'object') return
            for (const key in obj) {
              const val = obj[key]
              if (typeof val === 'string') {
                if (!video && val.startsWith('http') && (val.includes('.mp4') || key.includes('video_url') || key.includes('videoUrl'))) {
                  video = val
                }
                if (!image && val.startsWith('http') && (val.includes('.jpg') || val.includes('.webp') || val.includes('cdninstagram'))) {
                  if (key.toLowerCase().includes('thumb') || key.toLowerCase().includes('cover') || key.toLowerCase().includes('frame') || key.toLowerCase().includes('display')) {
                    image = val
                  }
                }
                if (!description && val.length > 20 && !val.startsWith('http') && !val.includes('{')) {
                  description = val
                }
              } else if (typeof val === 'object') {
                findInstaData(val)
              }
            }
          }
          findInstaData(rapidData)
        }

        const proxyImage = image ? `/api/parse-url?image=${encodeURIComponent(image)}` : ''

        return res.status(200).json({
          title: '',
          description: description.trim(),
          image: proxyImage,
          originalImage: image,
          video: video || '',
          source: url
        })
      }
    } catch (err) {
      console.warn('Instagram RapidAPI error:', err.message)
    }
  }

  // =========================================================================
  // 2. PINTEREST (Pins, Video Pins & pin.it short links)
  // =========================================================================
  if (url.includes('pinterest.') || url.includes('pin.it/')) {
    try {
      // Resolve short links pin.it
      let targetUrl = url
      const headRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15' },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000)
      })
      targetUrl = headRes.url || url
      const html = await headRes.text()

      let title = extractMeta(html, 'og:title') || extractMeta(html, 'title') || ''
      let description = extractMeta(html, 'og:description') || extractMeta(html, 'description') || ''
      let image = extractMeta(html, 'og:image') || ''
      let video = extractMeta(html, 'og:video') || extractMeta(html, 'og:video:secure_url') || ''

      // Try finding high-res video inside Pinterest JSON data
      const jsonMatch = html.match(/<script id="__PWS_DATA__"[^>]*>([\s\S]*?)<\/script>/i) ||
                        html.match(/<script data-test-id="leaf-snippet"[^>]*>([\s\S]*?)<\/script>/i)
      if (jsonMatch && jsonMatch[1]) {
        try {
          const pinData = JSON.parse(jsonMatch[1])
          function findPinVideo(obj) {
            if (!obj || typeof obj !== 'object') return
            for (const k in obj) {
              const val = obj[k]
              if (k === 'videos' || k === 'video_list') {
                for (const vKey in val) {
                  const vObj = val[vKey]
                  if (vObj?.url && vObj.url.includes('.mp4')) {
                    video = vObj.url
                    break
                  }
                }
              }
              if (typeof val === 'object') findPinVideo(val)
            }
          }
          findPinVideo(pinData)
        } catch (e) {}
      }

      if (!video) {
        const mp4Match = html.match(/"(https:\/\/[^"]+\.mp4[^"]*)"/i) || html.match(/<source[^>]*src="([^"]+\.mp4[^"]*)"/i)
        if (mp4Match && mp4Match[1]) {
          video = mp4Match[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/')
        }
      }

      title = title.replace(/\s*\|\s*Pinterest.*$/i, '').trim()
      description = description.replace(/\s*\|\s*Pinterest.*$/i, '').trim()
      const proxyImage = image ? `/api/parse-url?image=${encodeURIComponent(image)}` : ''

      return res.status(200).json({
        title,
        description,
        image: proxyImage,
        originalImage: image,
        video,
        source: url
      })
    } catch (err) {
      console.warn('Pinterest parser error:', err.message)
    }
  }

  // =========================================================================
  // 3. TELEGRAM (Posts, Media & Video)
  // =========================================================================
  if (url.includes('t.me/')) {
    try {
      const tgEmbedUrl = url.includes('?embed=1') || url.includes('&embed=1') 
        ? url 
        : url + (url.includes('?') ? '&embed=1' : '?embed=1')

      const tgRes = await fetch(tgEmbedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000)
      })

      if (tgRes.ok) {
        const html = await tgRes.text()
        let description = ''
        let title = 'Telegram'
        let image = ''
        let video = ''

        const tgTextMatch = html.match(/<div[^>]*class=["'][^"']*tgme_widget_message_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
        if (tgTextMatch && tgTextMatch[1]) {
          description = cleanHtmlText(tgTextMatch[1])
        }

        const tgAuthorMatch = html.match(/<span[^>]*class=["'][^"']*tgme_widget_message_owner_name[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) ||
                              html.match(/<a[^>]*class=["'][^"']*tgme_widget_message_owner_name[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)
        if (tgAuthorMatch && tgAuthorMatch[1]) {
          title = cleanHtmlText(tgAuthorMatch[1])
        }

        // Image extraction
        const tgImgMatch = html.match(/background-image:url\(['"]?([^'"]+)['"]?\)/i)
        if (tgImgMatch && tgImgMatch[1]) {
          image = decodeEntities(tgImgMatch[1])
        }

        // Video extraction
        const tgVideoMatch = html.match(/<video[^>]*src=["']([^"']+)["']/i) ||
                             html.match(/class=["'][^"']*tgme_widget_message_video_player[^"']*["'][^>]*src=["']([^"']+)["']/i)
        if (tgVideoMatch && tgVideoMatch[1]) {
          video = decodeEntities(tgVideoMatch[1])
        }

        const proxyImage = image ? `/api/parse-url?image=${encodeURIComponent(image)}` : ''

        return res.status(200).json({
          title,
          description,
          image: proxyImage,
          originalImage: image,
          video,
          source: url
        })
      }
    } catch (err) {
      console.warn('Telegram parser error:', err.message)
    }
  }

  // =========================================================================
  // 4. MAX.RU
  // =========================================================================
  if (url.includes('max.ru/')) {
    try {
      const maxRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000)
      })

      if (maxRes.ok) {
        const html = await maxRes.text()
        let description = ''
        let image = ''
        let video = ''

        const maxTextMatch = html.match(/message:\s*\{.*?text:\s*"([\s\S]*?[^\\])"\s*[,}]/i) ||
                             html.match(/"text":\s*"([\s\S]*?[^\\])"/i)
        if (maxTextMatch && maxTextMatch[1]) {
          description = decodeEntities(maxTextMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
        }

        const maxImgMatch = html.match(/attachment:.*?url:\s*"([^"]+)"/i) ||
                            html.match(/"(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i) ||
                            html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
        if (maxImgMatch && maxImgMatch[1]) {
          image = maxImgMatch[1].replace(/\\u0026/g, '&')
        }

        // Comprehensive search for video (mp4, mov, video URL, attachment)
        const maxVideoMatch = html.match(/"(https:\/\/[^"]+\.(?:mp4|mov)[^"]*)"/i) ||
                              html.match(/<video[^>]*src=["']([^"']+)["']/i) ||
                              html.match(/<source[^>]*src=["']([^"']+)["']/i) ||
                              html.match(/video:.*?url:\s*"([^"]+)"/i) ||
                              html.match(/"video":\s*\{[^}]*?"url":\s*"([^"]+)"/i) ||
                              html.match(/"video_url":\s*"([^"]+)"/i) ||
                              html.match(/"videoUrl":\s*"([^"]+)"/i) ||
                              html.match(/"contentUrl":\s*"([^"]+)"/i) ||
                              html.match(/"stream_url":\s*"([^"]+)"/i)
        if (maxVideoMatch && maxVideoMatch[1]) {
          video = maxVideoMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/')
        }

        const proxyImage = image ? `/api/parse-url?image=${encodeURIComponent(image)}` : ''

        return res.status(200).json({
          title: '',
          description: description.trim(),
          image: proxyImage,
          originalImage: image,
          video: video || '',
          source: url
        })
      }
    } catch (err) {
      console.warn('Max parser error:', err.message)
    }
  }

  // =========================================================================
  // 5. VK (ВКонтакте: Видео, Клипы, Посты, vkvideo.ru, m.vk.com)
  // =========================================================================
  if (url.includes('vk.com') || url.includes('vkvideo.ru') || url.includes('vk.ru')) {
    try {
      // Extract video/clip ID (e.g. clip-224424384_456239108 or video-224424384_456239108)
      const vkVideoIdMatch = url.match(/(?:video|clip)(-?\d+_\d+)/i)
      let vkEmbedUrl = ''
      let oid = '', id = ''
      if (vkVideoIdMatch) {
        const parts = vkVideoIdMatch[1].split('_')
        oid = parts[0]
        id = parts[1]
        vkEmbedUrl = `https://vk.com/video_ext.php?oid=${oid}&id=${id}&hd=2`
      }

      let title = 'ВКонтакте'
      let description = ''
      let image = ''
      let video = vkEmbedUrl

      // 1. Try to get direct video hash via al_video.php (internal fast VK endpoint)
      if (oid && id) {
        try {
          const spaRes = await fetch(`https://vk.com/al_video.php?act=show_inline&al=1&video=${oid}_${id}`, {
            method: 'POST',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': 'https://vk.com/'
            },
            signal: AbortSignal.timeout(4000)
          })
          if (spaRes.ok) {
            const spaText = await spaRes.text()
            const hashMatch = spaText.match(/"([a-f0-9]{18})"/i)
            if (hashMatch && hashMatch[1]) {
              video = `https://vk.com/video_ext.php?oid=${oid}&id=${id}&hash=${hashMatch[1]}&hd=2`
            }
          }
        } catch (e) {}
      }

      // 2. Try fetching HTML page with manual redirect to prevent redirect loop errors
      try {
        let currentUrl = url
        let pageRes = null
        for (let i = 0; i < 3; i++) {
          pageRes = await fetch(currentUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            redirect: 'manual',
            signal: AbortSignal.timeout(5000)
          })
          if (pageRes && pageRes.status >= 300 && pageRes.status < 400 && pageRes.headers.get('location')) {
            currentUrl = pageRes.headers.get('location')
            if (!currentUrl.startsWith('http')) currentUrl = 'https://vk.com' + currentUrl
          } else {
            break
          }
        }

        if (pageRes && pageRes.ok) {
          const rawBuffer = Buffer.from(await pageRes.arrayBuffer())
          let html = ''
          try {
            html = new TextDecoder('windows-1251').decode(rawBuffer)
            if (!html.includes('ВКонтакте') && !html.includes('vk.com')) {
              html = rawBuffer.toString('utf-8')
            }
          } catch (e) {
            html = rawBuffer.toString('utf-8')
          }

          title = extractMeta(html, 'og:title') || extractMeta(html, 'title') || title
          description = extractMeta(html, 'og:description') || extractMeta(html, 'description') || ''
          image = extractMeta(html, 'og:image') || ''

          // Search for direct MP4 stream in HTML
          const mp4Match = html.match(/"url1080":\s*"([^"]+)"/i) ||
                           html.match(/"url720":\s*"([^"]+)"/i) ||
                           html.match(/"url480":\s*"([^"]+)"/i) ||
                           html.match(/"url360":\s*"([^"]+)"/i) ||
                           html.match(/"url240":\s*"([^"]+)"/i) ||
                           html.match(/<source[^>]*src="([^"]+\.mp4[^"]*)"/i) ||
                           html.match(/<video[^>]*src="([^"]+\.mp4[^"]*)"/i)
          if (mp4Match && mp4Match[1]) {
            video = mp4Match[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/\\/g, '')
          }

          // Search for image cover in HTML
          if (!image) {
            const imgMatch = html.match(/"(https:\/\/[^"]+(?:userapi\.com|vk\.com|vkvideo\.ru)[^"]+\.(?:jpg|jpeg|webp|png)[^"]*)"/i)
            if (imgMatch && imgMatch[1]) {
              image = imgMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/')
            }
          }

          // Extract wall text if present
          const vkPostTextMatch = html.match(/<div[^>]*class=["'][^"']*(?:wall_post_text|pi_text|PostContent|media_desc)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
          if (vkPostTextMatch && vkPostTextMatch[1]) {
            description = cleanHtmlText(vkPostTextMatch[1])
          }
        }
      } catch (e) {}

      description = cleanDescriptionText(description)
      title = title.replace(/\s*\|\s*ВКонтакте.*$/i, '').trim()
      const proxyImage = image ? `/api/parse-url?image=${encodeURIComponent(image)}` : ''

      return res.status(200).json({
        title,
        description,
        image: proxyImage,
        originalImage: image,
        video: video || '',
        source: url
      })
    } catch (err) {
      console.warn('VK parser error:', err.message)
    }
  }

  // =========================================================================
  // 6. GENERIC FALLBACK (OpenGraph + Schema.org Recipe)
  // =========================================================================
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    })

    if (!response.ok) {
      return res.status(422).json({ error: `Не удалось загрузить: ${response.status}` })
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    let html = buffer.toString('utf-8')

    let title = extractMeta(html, 'og:title') || extractMeta(html, 'title') || ''
    let description = extractMeta(html, 'og:description') || extractMeta(html, 'description') || ''
    let image = extractMeta(html, 'og:image') || ''
    let video = extractMeta(html, 'og:video') || extractMeta(html, 'og:video:secure_url') || ''

    // Try schema.org Recipe JSON-LD
    const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
    for (const match of jsonLdMatches) {
      try {
        const json = JSON.parse(match[1])
        const recipeObj = Array.isArray(json) ? json.find(i => i['@type'] === 'Recipe') : (json['@type'] === 'Recipe' ? json : (json['@graph'] ? json['@graph'].find(i => i['@type'] === 'Recipe') : null))
        if (recipeObj) {
          if (recipeObj.name) title = recipeObj.name
          if (recipeObj.description) description = recipeObj.description
          if (recipeObj.image) {
            image = Array.isArray(recipeObj.image) ? recipeObj.image[0] : (typeof recipeObj.image === 'object' ? recipeObj.image.url : recipeObj.image)
          }
          if (recipeObj.recipeInstructions) {
            let steps = []
            if (Array.isArray(recipeObj.recipeInstructions)) {
              steps = recipeObj.recipeInstructions.map(s => typeof s === 'string' ? s : s.text || s.name).filter(Boolean)
            } else if (typeof recipeObj.recipeInstructions === 'string') {
              steps = [recipeObj.recipeInstructions]
            }
            if (steps.length > 0) {
              description += '\n\nИнструкция:\n' + steps.join('\n')
            }
          }
          break
        }
      } catch (e) {}
    }

    description = cleanDescriptionText(description)
    const proxyImage = image ? `/api/parse-url?image=${encodeURIComponent(image)}` : ''

    return res.status(200).json({
      title,
      description,
      image: proxyImage,
      originalImage: image,
      video,
      source: url
    })

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Ошибка загрузки ссылки' })
  }
}

// Helpers
function extractMeta(html, property) {
  const r1 = new RegExp(`<meta[^>]*property=["'](?:og:)?${property}["'][^>]*content=["']([^"']*)["']`, 'i')
  const m1 = html.match(r1)
  if (m1) return decodeEntities(m1[1])
  const r2 = new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i')
  const m2 = html.match(r2)
  if (m2) return decodeEntities(m2[1])
  const r3 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["'](?:og:)?${property}["']`, 'i')
  const m3 = html.match(r3)
  if (m3) return decodeEntities(m3[1])
  return ''
}

function cleanHtmlText(text) {
  if (!text) return ''
  return decodeEntities(
    text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  ).trim()
}

function cleanDescriptionText(desc) {
  if (!desc) return ''
  return desc
    .replace(/<img[^>]*class=["'][^"']*emoji[^"']*["'][^>]*alt=["']([^"']+)["'][^>]*>/gi, '$1')
    .replace(/<img[^>]*alt=["']([^"']+)["'][^>]*class=["'][^"']*emoji[^"']*["']/gi, '$1')
    .split('Последние записи:')[0]
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
