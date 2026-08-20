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
          'x-rapidapi-key': '197b595825mshb9cb780e5787095p1f9a0bjsn3b39bfd96f62',
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

      let title = ''
      let description = ''
      let image = ''
      let video = ''

      // A) VK WALL POST (Пост на стене)
      if (wallMatch) {
        const [_, oid, id] = wallMatch

        // 1. Fetch al_wall to parse post data-exec with exact ID matching
        const hosts = ['vk.ru', 'vk.com', 'm.vk.com']
        for (const h of hosts) {
          try {
            const res = await fetch(`https://${h}/al_wall.php?act=get_wall`, {
              method: 'POST',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': `https://${h}/wall${oid}_${id}`
              },
              body: `act=get_wall&al=1&owner_id=${oid}&offset=0`,
              signal: AbortSignal.timeout(5000)
            })
            if (!res.ok) continue
            const buf = Buffer.from(await res.arrayBuffer())
            const text = new TextDecoder('windows-1251').decode(buf)
            if (text.length < 1000) continue

            // Parse PostContentContainer
            const marker = 'data-exec=\\"'
            let cursor = 0
            let targetItem = null
            let firstItem = null

            while ((cursor = text.indexOf(marker, cursor)) !== -1) {
              const start = cursor + marker.length
              const end = text.indexOf('\\">', start)
              if (end === -1) break
              const rawAttr = text.slice(start, end)
              cursor = end + 3

              if (!rawAttr.includes('PostContentContainer')) continue

              const jsonStr = rawAttr
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/\\\\"/g, '\\"')
                .replace(/\\\\/g, '\\')
                .replace(/\\\//g, '/')

              try {
                const data = JSON.parse(jsonStr)
                const initData = data['PostContentContainer/init'] || data
                const item = initData.item || {}

                if (!firstItem) firstItem = item
                if (item.id == id || item.post_id == id) {
                  targetItem = item
                  break
                }
              } catch(e) {}
            }

            const chosenItem = targetItem || firstItem
            if (chosenItem) {
              if (chosenItem.text) {
                description = chosenItem.text
                  .replace(/<br\s*\/?>/gi, '\n')
                  .replace(/<[^>]+>/g, '')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/&amp;/g, '&')
                  .trim()
              }

              const attachments = chosenItem.attachments || []
              for (const att of attachments) {
                if (att.type === 'video' && !video) {
                  const v = att.video
                  if (v?.access_key && v?.owner_id && v?.id) {
                    video = `https://vk.com/video_ext.php?oid=${v.owner_id}&id=${v.id}&hash=${v.access_key}&hd=2`
                  } else if (v?.owner_id && v?.id) {
                    video = `https://vk.com/video_ext.php?oid=${v.owner_id}&id=${v.id}&hd=2`
                  }
                }
                if (att.type === 'photo' && !image) {
                  const sizes = att.photo?.sizes || []
                  if (sizes.length > 0) {
                    image = sizes[sizes.length - 1]?.url || ''
                  }
                }
              }
            }

            if (description || image || video) break
          } catch(e) {}
        }

        // Clean title from first line of text
        if (description) {
          const firstLine = description.split('\n').filter(l => l.trim())[0] || ''
          title = firstLine.length > 60 ? firstLine.slice(0, 60) + '...' : firstLine
        }
        if (!title) title = 'Рецепт из ВКонтакте'

      }

      // B) VK VIDEO / CLIP (Видео или Клип)
      else if (videoMatch) {
        const [_, oid, id] = videoMatch
        video = `https://vk.com/video_ext.php?oid=${oid}&id=${id}&hd=2`

        // Query al_video with act=show to get full description, thumbnail, title, and hash
        const hosts = ['vk.ru', 'vk.com', 'm.vk.com']
        for (const h of hosts) {
          try {
            const res = await fetch(`https://${h}/al_video.php`, {
              method: 'POST',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': `https://${h}/clip${oid}_${id}`
              },
              body: `act=show&al=1&video=${oid}_${id}&list=clip${oid}_${id}`,
              signal: AbortSignal.timeout(5000)
            })
            if (!res.ok) continue

            const buf = Buffer.from(await res.arrayBuffer())
            let text = new TextDecoder('windows-1251').decode(buf)
            text = text.replace(/\\"/g, '"').replace(/\\\//g, '/').replace(/\\n/g, '\n').replace(/&quot;/g, '"').replace(/&amp;/g, '&')

            // 1. Extract Description
            const descMatch = text.match(/"description":\s*"([\s\S]*?[^\\])"/i)
            if (descMatch && descMatch[1]) {
              description = descMatch[1]
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<a\b[^>]*>[\s\S]*?(?:<\/a>|$)/gi, '')
                .replace(/<[^>]+>/g, '')
                .replace(/&#33;/g, '!')
                .replace(/&#39;/g, "'")
                .replace(/<a\b.*/gi, '')
                .trim()
            }

            // 2. Extract Video Hash
            const hashMatch = text.match(/"([a-f0-9]{18})"/i)
            if (hashMatch && hashMatch[1]) {
              video = `https://vk.com/video_ext.php?oid=${oid}&id=${id}&hash=${hashMatch[1]}&hd=2`
            }

            // 3. Extract Thumbnail
            const thumbMatch = text.match(/"thumb":\s*"([^"]+)"/i) || text.match(/"(https:\/\/sun9-[^"]+video_thumb[^"]*)"/i)
            if (thumbMatch && thumbMatch[1]) {
              image = thumbMatch[1]
            }

            // 4. Extract Title
            if (description) {
              const firstLine = description.split('\n').filter(l => l.trim())[0] || ''
              title = firstLine.length > 60 ? firstLine.slice(0, 60) + '...' : firstLine
            }
            if (!title) {
              const titleMatch = text.match(/"title":\s*"([\s\S]*?[^\\])"/i) || text.match(/"md_title":\s*"([\s\S]*?[^\\])"/i)
              if (titleMatch && titleMatch[1] && !titleMatch[1].startsWith('Clip by') && !titleMatch[1].startsWith('Video by')) {
                title = titleMatch[1]
              }
            }

            if (description || image) break
          } catch(e) {}
        }

        if (!title) title = 'VK Клип'
      }

      description = cleanDescriptionText(description)
      const proxyImage = image ? `/api/parse-url?image=${encodeURIComponent(image)}` : ''

      return res.status(200).json({
        title: title || 'Новый рецепт',
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
