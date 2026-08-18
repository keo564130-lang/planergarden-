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
          'Referer': 'https://vk.ru/'
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

        const tgImgMatch = html.match(/background-image:url\(['"]?([^'"]+)['"]?\)/i)
        if (tgImgMatch && tgImgMatch[1]) {
          image = decodeEntities(tgImgMatch[1])
        }

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
  // 4. MAX.RU / MAX APP
  // =========================================================================
  if (url.includes('max.ru') || url.includes('max.im') || url.includes('max-app')) {
    try {
      const maxRes = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(8000)
      })

      if (maxRes.ok) {
        const html = await maxRes.text()
        let description = ''
        let image = ''
        let video = ''

        // SvelteKit data or JSON payloads
        const maxTextMatch = html.match(/message:\s*\{.*?text:\s*"([\s\S]*?[^\\])"\s*[,}]/i) ||
                             html.match(/"text":\s*"([\s\S]*?[^\\])"/i) ||
                             html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
        if (maxTextMatch && maxTextMatch[1]) {
          description = decodeEntities(maxTextMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
        }

        const maxImgMatch = html.match(/attachment:.*?url:\s*"([^"]+)"/i) ||
                            html.match(/"(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i) ||
                            html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
        if (maxImgMatch && maxImgMatch[1]) {
          image = maxImgMatch[1].replace(/\\u0026/g, '&')
        }

        // Comprehensive search for direct video stream in Max
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

        // Try SvelteKit __data.json if direct video wasn't found in initial HTML
        if (!video) {
          try {
            const dataJsonUrl = url.replace(/\/$/, '') + '/__data.json'
            const djRes = await fetch(dataJsonUrl, { signal: AbortSignal.timeout(4000) })
            if (djRes.ok) {
              const djText = await djRes.text()
              const djVid = djText.match(/"(https:\/\/[^"]+\.(?:mp4|mov)[^"]*)"/i)
              if (djVid && djVid[1]) video = djVid[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/')
            }
          } catch(e) {}
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
  // 5. VK (ВКонтакте: Видео, Клипы, Посты на стене, vkvideo.ru, m.vk.com)
  // =========================================================================
  if (url.includes('vk.com') || url.includes('vkvideo.ru') || url.includes('vk.ru')) {
    try {
      const wallMatch = url.match(/wall(-?\d+)_(\d+)/i)
      const videoMatch = url.match(/(?:video|clip)(-?\d+)_(\d+)/i)

      let title = 'ВКонтакте'
      let description = ''
      let image = ''
      let video = ''

      // A) VK WALL POST (Пост на стене)
      if (wallMatch) {
        const [_, oid, id] = wallMatch
        try {
          const res = await fetch(`https://vk.ru/al_wall.php?act=get_wall`, {
            method: 'POST',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': `https://vk.ru/wall${oid}_${id}`
            },
            body: `act=get_wall&al=1&owner_id=${oid}&offset=0`,
            signal: AbortSignal.timeout(6000)
          })

          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer())
            let text = new TextDecoder('windows-1251').decode(buf)
            text = text.replace(/\\"/g, '"').replace(/\\\//g, '/').replace(/\\n/g, '\n').replace(/&quot;/g, '"').replace(/&amp;/g, '&')

            const postKey = `${oid}_${id}`
            let postSnippet = text
            const postIdx = text.indexOf(`data-post-id="${postKey}"`) !== -1 ? text.indexOf(`data-post-id="${postKey}"`) : text.indexOf(`id="post${postKey}"`)
            if (postIdx !== -1) {
              postSnippet = text.slice(postIdx, postIdx + 12000)
            }

            // Extract post text
            const textMatch = postSnippet.match(/"text":\s*"([\s\S]*?[^\\])"/i)
            if (textMatch && textMatch[1]) {
              description = textMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
            }

            // Extract video attachment with hash
            const vidIdMatch = postSnippet.match(/"owner_id":\s*(-?\d+)[\s\S]*?"id":\s*(\d+)[\s\S]*?"access_key":\s*"([^"]+)"/i) ||
                               postSnippet.match(/"type":\s*"video"[\s\S]*?"access_key":\s*"([^"]+)"/i)
            if (vidIdMatch && vidIdMatch[1] && vidIdMatch[2] && vidIdMatch[3]) {
              video = `https://vk.com/video_ext.php?oid=${vidIdMatch[1]}&id=${vidIdMatch[2]}&hash=${vidIdMatch[3]}&hd=2`
            } else {
              const vidSimple = postSnippet.match(/href=["']\/(video[^"']+)["']/i) || postSnippet.match(/data-video=["']([^"']+)["']/i)
              if (vidSimple && vidSimple[1]) {
                const vm = vidSimple[1].match(/(-?\d+)_(\d+)/)
                if (vm) video = `https://vk.com/video_ext.php?oid=${vm[1]}&id=${vm[2]}&hd=2`
              }
            }

            // Extract video description fallback
            if (!description) {
              const descMatch = postSnippet.match(/"description":\s*"([\s\S]*?[^\\])"/i)
              if (descMatch && descMatch[1]) {
                description = descMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
              }
            }

            // Extract high-res image
            const imgUrls = [...postSnippet.matchAll(/"url":\s*"(https:\/\/sun9-[^"]+)"/gi)].map(m => m[1])
            if (imgUrls.length > 0) {
              image = imgUrls[imgUrls.length - 1]
            } else {
              const rawImg = postSnippet.match(/"(https:\/\/sun9-[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)
              if (rawImg) image = rawImg[1]
            }
          }
        } catch (e) {}
      }

      // B) VK VIDEO / CLIP (Видео или Клип)
      else if (videoMatch) {
        const [_, oid, id] = videoMatch
        video = `https://vk.com/video_ext.php?oid=${oid}&id=${id}&hd=2`

        // 1. Get video hash via fast internal gateway
        try {
          const spaRes = await fetch(`https://vk.ru/al_video.php?act=show_inline&al=1&video=${oid}_${id}`, {
            method: 'POST',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': `https://vk.ru/video${oid}_${id}`
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

        // 2. Fetch wall of owner to extract clip description & cover
        try {
          const wRes = await fetch(`https://vk.ru/al_wall.php?act=get_wall`, {
            method: 'POST',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': `https://vk.ru/video${oid}_${id}`
            },
            body: `act=get_wall&al=1&owner_id=${oid}&offset=0`,
            signal: AbortSignal.timeout(4000)
          })
          if (wRes.ok) {
            const buf = Buffer.from(await wRes.arrayBuffer())
            let text = new TextDecoder('windows-1251').decode(buf)
            text = text.replace(/\\"/g, '"').replace(/\\\//g, '/').replace(/\\n/g, '\n').replace(/&quot;/g, '"').replace(/&amp;/g, '&')

            const clipIdx = text.indexOf(id)
            if (clipIdx !== -1) {
              const snippet = text.slice(Math.max(0, clipIdx - 500), clipIdx + 4000)
              const descMatch = snippet.match(/"description":\s*"([\s\S]*?[^\\])"/i) || snippet.match(/"text":\s*"([\s\S]*?[^\\])"/i)
              if (descMatch && descMatch[1]) description = descMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()

              const imgUrls = [...snippet.matchAll(/"url":\s*"(https:\/\/sun9-[^"]+)"/gi)].map(m => m[1])
              if (imgUrls.length > 0) image = imgUrls[imgUrls.length - 1]
            }
          }
        } catch (e) {}
      }

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
